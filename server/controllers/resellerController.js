const storage = require('../db/storage');

function getCredits(req, res) {
  const reseller = req.reseller;
  const current = storage.findSubadmin(reseller.username);
  return res.json({
    status: 'success',
    credits: (current && current.credits) || 0
  });
}

function listLicenses(req, res) {
  const reseller = req.reseller;
  const licenses = storage.getLicensesByOwner(reseller.username);
  return res.json({
    status: 'success',
    licenses
  });
}

function createLicense(req, res) {
  const reseller = req.reseller;
  const { uid, name, days, hours, duration_hours } = req.body;

  if (!uid) {
    return res.status(400).json({ status: 'error', message: 'UID is required' });
  }

  const currentSub = storage.findSubadmin(reseller.username);
  if (!currentSub || (currentSub.credits || 0) < 1) {
    return res.status(400).json({
      status: 'error',
      message: 'Insufficient credits. Contact Master Admin to top up.'
    });
  }

  const existing = storage.findLicense(uid);
  if (existing) {
    return res.status(400).json({ status: 'error', message: `UID ${uid} already exists in vault` });
  }

  // Deduct 1 credit
  const deducted = storage.deductCreditFromSubadmin(reseller.username, 1);
  if (!deducted) {
    return res.status(400).json({ status: 'error', message: 'Credit deduction failed' });
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
    created_by: reseller.username,
    owner_role: 'sub_admin',
    createdAt: new Date().toISOString()
  };

  storage.addLicense(newLicense);
  storage.addAuditLog(reseller.username, -1, currentSub.credits, `UID Activation (${uid})`);

  return res.json({
    status: 'success',
    message: `UID ${uid} activated (1 credit deducted)`,
    license: newLicense,
    remaining_credits: currentSub.credits
  });
}

function updateLicense(req, res) {
  const reseller = req.reseller;
  const { uid, days } = req.body;

  if (!uid) {
    return res.status(400).json({ status: 'error', message: 'UID is required' });
  }

  const license = storage.findLicense(uid);
  if (!license || license.created_by !== reseller.username) {
    return res.status(404).json({ status: 'error', message: `UID ${uid} not found in your vault` });
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
  const reseller = req.reseller;
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ status: 'error', message: 'UID is required' });
  }

  const license = storage.findLicense(uid);
  if (!license || license.created_by !== reseller.username) {
    return res.status(404).json({ status: 'error', message: `UID ${uid} not found in your vault` });
  }

  storage.revokeLicense(uid);

  return res.json({
    status: 'success',
    message: `UID ${uid} permanently revoked`
  });
}

module.exports = {
  getCredits,
  listLicenses,
  createLicense,
  updateLicense,
  revokeLicense
};
