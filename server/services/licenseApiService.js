const config = require('../config/config');

class LicenseApiService {
  constructor(baseUrl = config.licenseApiBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Internal helper to make HTTP requests with timeout and error normalization
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const timeoutMs = options.timeout || 12000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = {
        'Accept': 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      };

      const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { success: res.ok, raw: text };
      }

      if (!res.ok) {
        const error = new Error(data.message || data.error || `HTTP ${res.status} from License API`);
        error.status = res.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`License API request timed out after ${timeoutMs}ms`);
        timeoutErr.status = 504;
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * Health check & API directory
   */
  async getStatus() {
    return this._request('/status');
  }

  /**
   * API aggregate statistics
   */
  async getStats() {
    return this._request('/stats');
  }

  /**
   * Get all licenses with optional filtering by status and search term
   * @param {Object} params
   * @param {string} [params.status] - 'Unused' | 'Used' | 'Banned'
   * @param {string} [params.search] - Search string
   */
  async getLicenses(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);

    const qs = query.toString();
    return this._request(`/licenses${qs ? '?' + qs : ''}`);
  }

  /**
   * Get single license by key or ID
   * @param {string} keyOrId
   */
  async getLicenseByKeyOrId(keyOrId) {
    if (!keyOrId) {
      throw new Error('Key or ID is required');
    }
    return this._request(`/licenses/${encodeURIComponent(keyOrId)}`);
  }

  /**
   * Create one or multiple license keys
   * @param {Object} payload
   * @param {string} [payload.duration="30 Days"]
   * @param {string} [payload.note]
   * @param {number} [payload.count=1]
   * @param {string} [payload.key] - Optional custom key string
   */
  async createLicense({ duration = '30 Days', note = '', count = 1, key } = {}) {
    const body = { duration, note, count: Number(count) || 1 };
    if (key) body.key = key;

    return this._request('/licenses/create', {
      method: 'POST',
      body
    });
  }

  /**
   * Ban a license key
   * @param {Object} payload
   * @param {string} payload.key
   * @param {string} [payload.reason="Terms violation"]
   */
  async banLicense({ key, reason = 'Terms violation' } = {}) {
    if (!key) throw new Error('License key is required to ban');
    return this._request('/licenses/ban', {
      method: 'POST',
      body: { key, reason }
    });
  }

  /**
   * Unban a license key
   * @param {Object} payload
   * @param {string} payload.key
   */
  async unbanLicense({ key } = {}) {
    if (!key) throw new Error('License key is required to unban');
    return this._request('/licenses/unban', {
      method: 'POST',
      body: { key }
    });
  }

  /**
   * Reset Hardware ID (HWID) binding
   * @param {Object} payload
   * @param {string} payload.key
   */
  async resetHwid({ key } = {}) {
    if (!key) throw new Error('License key is required to reset HWID');
    return this._request('/licenses/reset-hwid', {
      method: 'POST',
      body: { key }
    });
  }
}

module.exports = new LicenseApiService();
