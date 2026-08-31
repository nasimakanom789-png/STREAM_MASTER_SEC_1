const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../config/config');

const DATA_FILE = path.join(__dirname, '../../data/storage.json');

class StorageEngine {
  constructor() {
    this.isMongo = false;
    this.data = {
      settings: {
        master_admin_key: config.masterAdminKey
      },
      subadmins: [],
      fetchers: [],
      licenses: [],
      creditAuditLog: []
    };
  }

  async init() {
    // If MongoDB URI is configured, attempt connection
    if (config.mongoUri) {
      try {
        const mongoose = require('mongoose');
        await mongoose.connect(config.mongoUri);
        this.isMongo = true;
        console.log('[DB] Connected to MongoDB database successfully.');
        return;
      } catch (err) {
        console.warn('[DB] MongoDB connection failed. Falling back to local storage engine:', err.message);
      }
    }

    // Local JSON File Storage
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        this.data = JSON.parse(raw);
        // Ensure master admin key exists
        if (!this.data.settings || !this.data.settings.master_admin_key) {
          this.data.settings = { master_admin_key: config.masterAdminKey };
        }
      } else {
        await this.seedInitialData();
        this.save();
      }
    } catch (e) {
      console.error('[DB] Error loading local storage. Rebuilding default state:', e);
      await this.seedInitialData();
      this.save();
    }
  }

  save() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[DB] Error persisting data file:', err);
    }
  }

  async hashPassword(plainText) {
    try {
      const salt = await bcrypt.genSalt(10);
      return await bcrypt.hash(plainText, salt);
    } catch (e) {
      return plainText;
    }
  }

  async comparePassword(plainText, hash) {
    try {
      if (hash && hash.startsWith('$2')) {
        return await bcrypt.compare(plainText, hash);
      }
      return plainText === hash;
    } catch (e) {
      return plainText === hash;
    }
  }

  async seedInitialData() {
    const defaultResellerPass = await this.hashPassword('reseller123');
    const defaultFetcherPass = await this.hashPassword('fetcher123');

    const now = new Date();
    const activeExpiry = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString();
    const expiringExpiry = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const expiredExpiry = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    this.data = {
      settings: {
        master_admin_key: config.masterAdminKey
      },
      subadmins: [
        {
          username: 'reseller_demo',
          passwordHash: defaultResellerPass,
          plainPassword: 'reseller123',
          note: 'EU Core Distributor',
          credits: 50,
          createdAt: new Date().toISOString()
        },
        {
          username: 'apex_streamer',
          passwordHash: defaultResellerPass,
          plainPassword: 'reseller123',
          note: 'VIP Partner',
          credits: 120,
          createdAt: new Date().toISOString()
        }
      ],
      fetchers: [
        {
          username: 'fetcher_demo',
          passwordHash: defaultFetcherPass,
          plainPassword: 'fetcher123',
          note: 'Auto Ingestion Bot',
          permission_days: 30,
          createdAt: new Date().toISOString()
        },
        {
          username: 'fast_provisioner',
          passwordHash: defaultFetcherPass,
          plainPassword: 'fetcher123',
          note: 'Fast 7-Day Access Worker',
          permission_days: 7,
          createdAt: new Date().toISOString()
        }
      ],
      licenses: [
        {
          uid: 'UID-882910384',
          name: 'Shadow Assassin',
          days: 30,
          expires_at: activeExpiry,
          created_by: 'ADMIN',
          owner_role: 'main_admin',
          createdAt: new Date().toISOString()
        },
        {
          uid: 'UID-559102482',
          name: 'Cyber Falcon',
          days: 7,
          expires_at: expiringExpiry,
          created_by: 'reseller_demo',
          owner_role: 'sub_admin',
          createdAt: new Date().toISOString()
        },
        {
          uid: 'UID-110293847',
          name: 'Vortex Ghost',
          days: 15,
          expires_at: expiredExpiry,
          created_by: 'fetcher_demo',
          owner_role: 'fetcher',
          createdAt: new Date().toISOString()
        }
      ],
      creditAuditLog: [
        {
          username: 'reseller_demo',
          change: '+50',
          balAfter: 50,
          reason: 'Initial System Provision',
          date: new Date().toLocaleString('en-GB')
        },
        {
          username: 'apex_streamer',
          change: '+120',
          balAfter: 120,
          reason: 'Partner License Grant',
          date: new Date().toLocaleString('en-GB')
        }
      ]
    };
  }

  // --- SETTINGS ---
  getMasterAdminKey() {
    return (this.data.settings && this.data.settings.master_admin_key) || config.masterAdminKey;
  }

  setMasterAdminKey(newKey) {
    if (!this.data.settings) this.data.settings = {};
    this.data.settings.master_admin_key = newKey;
    this.save();
  }

  // --- LICENSES / UIDS ---
  getAllLicenses() {
    return [...this.data.licenses];
  }

  getLicensesByOwner(username) {
    return this.data.licenses.filter(l => l.created_by === username);
  }

  findLicense(uid) {
    return this.data.licenses.find(l => l.uid === uid || l.id === uid || l.user_id === uid);
  }

  addLicense(licenseObj) {
    this.data.licenses.unshift(licenseObj);
    this.save();
    return licenseObj;
  }

  updateLicenseExpiry(uid, newExpiresAt, addedDays) {
    const license = this.findLicense(uid);
    if (!license) return null;
    license.expires_at = newExpiresAt;
    license.days = (license.days || 0) + addedDays;
    license.updatedAt = new Date().toISOString();
    this.save();
    return license;
  }

  revokeLicense(uid) {
    const idx = this.data.licenses.findIndex(l => l.uid === uid || l.id === uid || l.user_id === uid);
    if (idx === -1) return false;
    this.data.licenses.splice(idx, 1);
    this.save();
    return true;
  }

  // --- RESELLERS (SUB-ADMINS) ---
  getAllSubadmins() {
    return this.data.subadmins.map(s => ({
      username: s.username,
      note: s.note,
      credits: s.credits || 0,
      createdAt: s.createdAt
    }));
  }

  findSubadmin(username) {
    return this.data.subadmins.find(s => s.username.toLowerCase() === (username || '').toLowerCase());
  }

  async addSubadmin(username, password, note = '', initialCredits = 0) {
    const existing = this.findSubadmin(username);
    if (existing) return null;
    const passwordHash = await this.hashPassword(password);
    const subadmin = {
      username,
      passwordHash,
      plainPassword: password,
      note,
      credits: initialCredits || 0,
      createdAt: new Date().toISOString()
    };
    this.data.subadmins.unshift(subadmin);
    this.save();
    return subadmin;
  }

  deleteSubadmin(username) {
    const idx = this.data.subadmins.findIndex(s => s.username.toLowerCase() === (username || '').toLowerCase());
    if (idx === -1) return false;
    this.data.subadmins.splice(idx, 1);
    this.save();
    return true;
  }

  addCreditsToSubadmin(username, amount) {
    const sub = this.findSubadmin(username);
    if (!sub) return null;
    sub.credits = (sub.credits || 0) + amount;
    sub.updatedAt = new Date().toISOString();
    this.save();
    return sub.credits;
  }

  deductCreditFromSubadmin(username, amount = 1) {
    const sub = this.findSubadmin(username);
    if (!sub || (sub.credits || 0) < amount) return false;
    sub.credits -= amount;
    sub.updatedAt = new Date().toISOString();
    this.save();
    return true;
  }

  // --- FETCHERS ---
  getAllFetchers() {
    return this.data.fetchers.map(f => ({
      username: f.username,
      note: f.note,
      permission_days: f.permission_days || 0,
      createdAt: f.createdAt
    }));
  }

  findFetcher(username) {
    return this.data.fetchers.find(f => f.username.toLowerCase() === (username || '').toLowerCase());
  }

  async addFetcher(username, password, note = '', permission_days = 30) {
    const existing = this.findFetcher(username);
    if (existing) return null;
    const passwordHash = await this.hashPassword(password);
    const fetcher = {
      username,
      passwordHash,
      plainPassword: password,
      note,
      permission_days: permission_days || 30,
      createdAt: new Date().toISOString()
    };
    this.data.fetchers.unshift(fetcher);
    this.save();
    return fetcher;
  }

  deleteFetcher(username) {
    const idx = this.data.fetchers.findIndex(f => f.username.toLowerCase() === (username || '').toLowerCase());
    if (idx === -1) return false;
    this.data.fetchers.splice(idx, 1);
    this.save();
    return true;
  }

  updateFetcherPermission(username, permission_days) {
    const fetcher = this.findFetcher(username);
    if (!fetcher) return null;
    fetcher.permission_days = permission_days;
    fetcher.updatedAt = new Date().toISOString();
    this.save();
    return fetcher;
  }

  // --- AUDIT LOG ---
  addAuditLog(username, change, balAfter, reason = 'Manual Admin Credit') {
    const entry = {
      username,
      change: (typeof change === 'number' && change > 0 ? '+' : '') + change,
      balAfter,
      reason,
      date: new Date().toLocaleString('en-GB')
    };
    this.data.creditAuditLog.unshift(entry);
    if (this.data.creditAuditLog.length > 200) {
      this.data.creditAuditLog = this.data.creditAuditLog.slice(0, 200);
    }
    this.save();
    return entry;
  }

  getAuditLogs() {
    return [...this.data.creditAuditLog];
  }
}

const storage = new StorageEngine();
module.exports = storage;
