const licenseApiService = require('../services/licenseApiService');
const storage = require('../db/storage');

function generateFormattedKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${block()}-${block()}-${block()}-${block()}`;
}

function parseDurationMs(durationStr) {
  const str = (durationStr || '30 Days').toLowerCase();
  const num = parseInt(str) || 30;
  if (str.includes('year')) return num * 365 * 24 * 60 * 60 * 1000;
  if (str.includes('lifetime')) return 10 * 365 * 24 * 60 * 60 * 1000;
  if (str.includes('hour')) return num * 60 * 60 * 1000;
  return num * 24 * 60 * 60 * 1000;
}

/**
 * Controller providing proxied access and management for external license API
 * with automatic resilient local engine fallback
 */
class LicenseProxyController {
  /**
   * Health & Status check of the proxy and external API
   */
  async getStatus(req, res) {
    try {
      const data = await licenseApiService.getStatus();
      return res.json({
        proxy_status: 'online',
        timestamp: new Date().toISOString(),
        external_api: data
      });
    } catch (err) {
      return res.status(err.status || 502).json({
        proxy_status: 'degraded',
        message: 'Failed to reach external license API',
        error: err.message
      });
    }
  }

  /**
   * License statistics
   */
  async getStats(req, res) {
    try {
      let extStats = { total: 0, unused: 0, used: 0, banned: 0, hwid_locked: 0 };
      try {
        const data = await licenseApiService.getStats();
        if (data && data.stats) extStats = data.stats;
      } catch (e) {
        // ignore external error
      }

      const localList = storage.getAllApiLicenses();
      const localStats = {
        total: localList.length,
        unused: localList.filter(l => l.status === 'Unused').length,
        used: localList.filter(l => l.status === 'Used').length,
        banned: localList.filter(l => l.status === 'Banned').length,
        hwid_locked: localList.filter(l => l.hwidLocked || l.hwid).length
      };

      return res.json({
        success: true,
        stats: {
          total: extStats.total + localStats.total,
          unused: extStats.unused + localStats.unused,
          used: extStats.used + localStats.used,
          banned: extStats.banned + localStats.banned,
          hwid_locked: extStats.hwid_locked + localStats.hwid_locked
        }
      });
    } catch (err) {
      return res.status(err.status || 500).json({
        success: false,
        message: err.message,
        details: err.data || null
      });
    }
  }

  /**
   * Get all licenses with optional filtering (?status=Unused&search=xyz)
   */
  async getLicenses(req, res) {
    try {
      const { status, search } = req.query;
      let externalLicenses = [];
      try {
        const data = await licenseApiService.getLicenses({ status, search });
        if (data && Array.isArray(data.licenses)) {
          externalLicenses = data.licenses;
        }
      } catch (err) {
        // external license fetch degraded
      }

      const localLicenses = storage.getAllApiLicenses();
      let combined = [...localLicenses, ...externalLicenses];

      if (status && status !== 'all') {
        combined = combined.filter(l => (l.status || '').toLowerCase() === status.toLowerCase());
      }
      if (search) {
        const q = search.toLowerCase();
        combined = combined.filter(l =>
          (l.key && l.key.toLowerCase().includes(q)) ||
          (l.note && l.note.toLowerCase().includes(q)) ||
          (l.hwid && l.hwid.toLowerCase().includes(q)) ||
          (l.assignedTo && l.assignedTo.toLowerCase().includes(q))
        );
      }

      return res.json({
        success: true,
        licenses: combined,
        total_count: combined.length
      });
    } catch (err) {
      return res.status(err.status || 500).json({
        success: false,
        message: err.message,
        details: err.data || null
      });
    }
  }

  /**
   * Get single license by key or ID
   */
  async getLicenseByKeyOrId(req, res) {
    try {
      const { keyOrId } = req.params;
      const local = storage.findApiLicense(keyOrId);
      if (local) {
        return res.json({ success: true, license: local });
      }
      const data = await licenseApiService.getLicenseByKeyOrId(keyOrId);
      return res.json(data);
    } catch (err) {
      return res.status(err.status || 500).json({
        success: false,
        message: err.message,
        details: err.data || null
      });
    }
  }

  /**
   * Create one or multiple license keys
   * Falls back automatically to local generator if external service reports insufficient credits
   */
  async createLicense(req, res) {
    const { duration, note, count, key } = req.body;
    try {
      const data = await licenseApiService.createLicense({ duration, note, count, key });
      return res.json(data);
    } catch (err) {
      const errString = (err.message || '') + JSON.stringify(err.data || '');
      const isCreditOrRemoteIssue = errString.includes('credit') || err.status === 402 || err.status === 500 || err.status === 502 || err.status === 504;

      if (isCreditOrRemoteIssue) {
        const totalCount = Math.max(1, Math.min(parseInt(count) || 1, 50));
        const createdLicenses = [];
        const durationText = duration || '30 Days';
        const ms = parseDurationMs(durationText);
        const expiresAt = new Date(Date.now() + ms).toISOString();

        for (let i = 0; i < totalCount; i++) {
          const generatedKey = (i === 0 && key) ? key.trim().toUpperCase() : generateFormattedKey();
          const newLicense = {
            id: 'loc_' + Math.random().toString(36).substring(2, 11),
            key: generatedKey,
            duration: durationText,
            note: (note || 'API Console Key').trim(),
            status: 'Unused',
            assignedTo: null,
            hwid: null,
            hardwareId: null,
            hwidLocked: false,
            createdBy: 'API_CONSOLE',
            createdAt: new Date().toISOString(),
            expiresAt
          };
          storage.addApiLicense(newLicense);
          createdLicenses.push(newLicense);
        }

        return res.json({
          success: true,
          message: 'Generated successfully (Local Engine · 0 Credit Required)',
          licenses: createdLicenses,
          total_count: createdLicenses.length
        });
      }

      return res.status(err.status || 400).json({
        success: false,
        message: err.message,
        details: err.data || null
      });
    }
  }

  /**
   * Ban a license key
   */
  async banLicense(req, res) {
    try {
      const { key, reason } = req.body;
      if (!key) {
        return res.status(400).json({ success: false, message: 'Field "key" is required' });
      }

      const local = storage.findApiLicense(key);
      if (local) {
        storage.updateApiLicense(key, { status: 'Banned', banReason: reason || 'Terms violation' });
        return res.json({ success: true, message: `License ${key} banned successfully` });
      }

      const data = await licenseApiService.banLicense({ key, reason });
      return res.json(data);
    } catch (err) {
      return res.status(err.status || 500).json({
        success: false,
        message: err.message,
        details: err.data || null
      });
    }
  }

  /**
   * Unban a license key
   */
  async unbanLicense(req, res) {
    try {
      const { key } = req.body;
      if (!key) {
        return res.status(400).json({ success: false, message: 'Field "key" is required' });
      }

      const local = storage.findApiLicense(key);
      if (local) {
        storage.updateApiLicense(key, { status: 'Unused', banReason: null });
        return res.json({ success: true, message: `License ${key} unbanned successfully` });
      }

      const data = await licenseApiService.unbanLicense({ key });
      return res.json(data);
    } catch (err) {
      return res.status(err.status || 500).json({
        success: false,
        message: err.message,
        details: err.data || null
      });
    }
  }

  /**
   * Reset Hardware ID (HWID) binding
   */
  async resetHwid(req, res) {
    try {
      const { key } = req.body;
      if (!key) {
        return res.status(400).json({ success: false, message: 'Field "key" is required' });
      }

      const local = storage.findApiLicense(key);
      if (local) {
        storage.updateApiLicense(key, { hwid: null, hardwareId: null, hwidLocked: false });
        return res.json({ success: true, message: `HWID reset for license ${key}` });
      }

      const data = await licenseApiService.resetHwid({ key });
      return res.json(data);
    } catch (err) {
      return res.status(err.status || 500).json({
        success: false,
        message: err.message,
        details: err.data || null
      });
    }
  }
}

module.exports = new LicenseProxyController();
