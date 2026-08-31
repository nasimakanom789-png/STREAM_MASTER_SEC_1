const storage = require('../db/storage');

function getPermission(req, res) {
  const fetcher = req.fetcher;
  const current = storage.findFetcher(fetcher.username);
  return res.json({
    status: 'success',
    permission_days: (current && current.permission_days) || 30
  });
}

function listLicenses(req, res) {
  const fetcher = req.fetcher;
  const licenses = storage.getLicensesByOwner(fetcher.username);
  return res.json({
    status: 'success',
    licenses
  });
}

function createLicense(req, res) {
  const fetcher = req.fetcher;
  const current = storage.findFetcher(fetcher.username);
  const permDays = (current && current.permission_days) || 30;

  const { uid, name } = req.body;

  if (!uid) {
    return res.status(400).json({ status: 'error', message: 'UID is required' });
  }

  const existing = storage.findLicense(uid);
  if (existing) {
    return res.status(400).json({ status: 'error', message: `UID ${uid} already exists in vault` });
  }

  const now = Date.now();
  const expiryMs = now + permDays * 24 * 60 * 60 * 1000;
  const expires_at = new Date(expiryMs).toISOString();

  const newLicense = {
    uid,
    name: (name || 'Player').trim(),
    days: permDays,
    expires_at,
    created_by: fetcher.username,
    owner_role: 'fetcher',
    createdAt: new Date().toISOString()
  };

  storage.addLicense(newLicense);

  return res.json({
    status: 'success',
    message: `UID ${uid} activated (${permDays} days)`,
    license: newLicense
  });
}

function updateLicense(req, res) {
  const fetcher = req.fetcher;
  const current = storage.findFetcher(fetcher.username);
  const permDays = (current && current.permission_days) || 30;

  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ status: 'error', message: 'UID is required' });
  }

  const license = storage.findLicense(uid);
  if (!license || license.created_by !== fetcher.username) {
    return res.status(404).json({ status: 'error', message: `UID ${uid} not found in your vault` });
  }

  const currentExpiry = license.expires_at ? new Date(license.expires_at).getTime() : Date.now();
  const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
  const newExpiry = new Date(baseTime + permDays * 24 * 60 * 60 * 1000).toISOString();

  const updated = storage.updateLicenseExpiry(uid, newExpiry, permDays);

  return res.json({
    status: 'success',
    message: `UID ${uid} extended by +${permDays} days`,
    license: updated
  });
}

function revokeLicense(req, res) {
  const fetcher = req.fetcher;
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ status: 'error', message: 'UID is required' });
  }

  const license = storage.findLicense(uid);
  if (!license || license.created_by !== fetcher.username) {
    return res.status(404).json({ status: 'error', message: `UID ${uid} not found in your vault` });
  }

  storage.revokeLicense(uid);

  return res.json({
    status: 'success',
    message: `UID ${uid} permanently revoked`
  });
}

module.exports = {
  getPermission,
  listLicenses,
  createLicense,
  updateLicense,
  revokeLicense
};
