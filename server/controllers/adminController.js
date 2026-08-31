const storage = require('../db/storage');

function listLicenses(req, res) {
  const licenses = storage.getAllLicenses();
  return res.json({
    status: 'success',
    licenses
  });
}

function createLicense(req, res) {
  const { uid, name, days, hours, duration_hours } = req.body;

  if (!uid) {
    return res.status(400).json({ status: 'error', message: 'UID is required' });
  }

  const existing = storage.findLicense(uid);
  if (existing) {
    return res.status(400).json({ status: 'error', message: `UID ${uid} already exists in vault` });
  }

  const now = Date.now();
  let expiryMs;
  let assignedDays = parseInt(days) || 30;

  if (hours || duration_hours) {
    const h = parseInt(hours || duration_hours) || 24;
    expiryMs = now + h * 60 * 60 * 1000;
    assignedDays = 1;
  } else {
    expiryMs = now + assignedDays * 24 * 60 * 60 * 1000;
  }

  const expires_at = new Date(expiryMs).toISOString();

  const newLicense = {
    uid,
    name: (name || 'Player').trim(),
    days: assignedDays,
    expires_at,
    created_by: 'ADMIN',
    owner_role: 'main_admin',
    createdAt: new Date().toISOString()
  };

  storage.addLicense(newLicense);

  return res.json({
    status: 'success',
    message: `UID ${uid} activated successfully`,
    license: newLicense
  });
}

function updateLicense(req, res) {
  const { uid, days } = req.body;
  if (!uid) {
    return res.status(400).json({ status: 'error', message: 'UID is required' });
  }

  const license = storage.findLicense(uid);
  if (!license) {
    return res.status(404).json({ status: 'error', message: `UID ${uid} not found` });
  }

  const addDays = parseInt(days) || 30;
  const currentExpiry = license.expires_at ? new Date(license.expires_at).getTime() : Date.now();
  const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
  const newExpiry = new Date(baseTime + addDays * 24 * 60 * 60 * 1000).toISOString();

  const updated = storage.updateLicenseExpiry(uid, newExpiry, addDays);

  return res.json({
    status: 'success',
    message: `UID ${uid} extended by +${addDays} days`,
    license: updated
  });
}

function revokeLicense(req, res) {
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).json({ status: 'error', message: 'UID is required' });
  }

  const success = storage.revokeLicense(uid);
  if (!success) {
    return res.status(404).json({ status: 'error', message: `UID ${uid} not found or already removed` });
  }

  return res.json({
    status: 'success',
    message: `UID ${uid} permanently revoked`
  });
}

function listSubadmins(req, res) {
  const subadmins = storage.getAllSubadmins();
  return res.json({
    status: 'success',
    subadmins
  });
}

async function createSubadmin(req, res) {
  const { username, password, note, credits } = req.body;

  if (!username || !password) {
    return res.status(400).json({ status: 'error', message: 'Username and password required' });
  }

  const initialCredits = parseInt(credits) || 0;
  const subadmin = await storage.addSubadmin(username.trim(), password.trim(), (note || '').trim(), initialCredits);

  if (!subadmin) {
    return res.status(400).json({ status: 'error', message: `Reseller '${username}' already exists` });
  }

  if (initialCredits > 0) {
    storage.addAuditLog(username, initialCredits, initialCredits, 'Initial Account Balance');
  }

  return res.json({
    status: 'success',
    message: `Reseller account '${username}' created`,
    subadmin: {
      username: subadmin.username,
      note: subadmin.note,
      credits: subadmin.credits
    }
  });
}

function giveCredits(req, res) {
  const { username, amount } = req.body;
  const creditAmount = parseInt(amount);

  if (!username || !creditAmount || creditAmount < 1) {
    return res.status(400).json({ status: 'error', message: 'Valid username and credit amount required' });
  }

  const newCredits = storage.addCreditsToSubadmin(username.trim(), creditAmount);
  if (newCredits === null) {
    return res.status(404).json({ status: 'error', message: `Reseller '${username}' not found` });
  }

  storage.addAuditLog(username, creditAmount, newCredits, 'Admin Manual Top-Up');

  return res.json({
    status: 'success',
    message: `Added +${creditAmount} credits to ${username}`,
    new_credits: newCredits
  });
}

function deleteSubadmin(req, res) {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ status: 'error', message: 'Username required' });
  }

  const success = storage.deleteSubadmin(username.trim());
  if (!success) {
    return res.status(404).json({ status: 'error', message: `Reseller '${username}' not found` });
  }

  return res.json({
    status: 'success',
    message: `Reseller '${username}' deleted`
  });
}

function listFetchers(req, res) {
  const fetchers = storage.getAllFetchers();
  return res.json({
    status: 'success',
    fetchers
  });
}

async function createFetcher(req, res) {
  const { username, password, note, permission_days } = req.body;

  if (!username || !password) {
    return res.status(400).json({ status: 'error', message: 'Username and password required' });
  }

  const days = parseInt(permission_days) || 30;
  const fetcher = await storage.addFetcher(username.trim(), password.trim(), (note || '').trim(), days);

  if (!fetcher) {
    return res.status(400).json({ status: 'error', message: `Fetcher '${username}' already exists` });
  }

  return res.json({
    status: 'success',
    message: `Fetcher '${username}' created with ${days}d permission`,
    fetcher: {
      username: fetcher.username,
      note: fetcher.note,
      permission_days: fetcher.permission_days
    }
  });
}

function updateFetcherPermission(req, res) {
  const { username, permission_days } = req.body;
  const days = parseInt(permission_days);

  if (!username || !days || days < 1) {
    return res.status(400).json({ status: 'error', message: 'Valid username and permission days required' });
  }

  const updated = storage.updateFetcherPermission(username.trim(), days);
  if (!updated) {
    return res.status(404).json({ status: 'error', message: `Fetcher '${username}' not found` });
  }

  return res.json({
    status: 'success',
    message: `Updated ${username} permission to ${days} days`,
    permission_days: days
  });
}

function deleteFetcher(req, res) {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ status: 'error', message: 'Username required' });
  }

  const success = storage.deleteFetcher(username.trim());
  if (!success) {
    return res.status(404).json({ status: 'error', message: `Fetcher '${username}' not found` });
  }

  return res.json({
    status: 'success',
    message: `Fetcher '${username}' deleted`
  });
}

function changeMasterKey(req, res) {
  const { admin_key, new_key } = req.body;

  if (!new_key || new_key.trim().length < 6) {
    return res.status(400).json({ status: 'error', message: 'New key must be at least 6 characters' });
  }

  storage.setMasterAdminKey(new_key.trim());

  return res.json({
    status: 'success',
    message: 'Master Key changed successfully'
  });
}

function dbStatus(req, res) {
  return res.json({
    status: 'success',
    database: 'connected',
    engine: storage.isMongo ? 'MongoDB' : 'Local Persistent JSON',
    ping: 'ok',
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  listLicenses,
  createLicense,
  updateLicense,
  revokeLicense,
  listSubadmins,
  createSubadmin,
  giveCredits,
  deleteSubadmin,
  listFetchers,
  createFetcher,
  updateFetcherPermission,
  deleteFetcher,
  changeMasterKey,
  dbStatus
};
