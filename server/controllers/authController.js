const storage = require('../db/storage');

async function unifiedLogin(req, res) {
  const identifier = (req.body.identifier || '').trim();
  const password = (req.body.password || '').trim();

  if (!identifier && !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Please enter your username or Master Secret Key'
    });
  }

  const currentMasterKey = storage.getMasterAdminKey();

  // 1. Check if identifier or password matches Master Admin Key
  if (identifier === currentMasterKey || (password && password === currentMasterKey)) {
    return res.json({
      status: 'success',
      role: 'main_admin',
      admin_key: currentMasterKey
    });
  }

  // 2. Check if identifier is a Reseller (Sub-Admin)
  if (identifier && password) {
    const sub = storage.findSubadmin(identifier);
    if (sub) {
      const match = await storage.comparePassword(password, sub.passwordHash || sub.plainPassword);
      if (match) {
        return res.json({
          status: 'success',
          role: 'sub_admin',
          username: sub.username,
          credits: sub.credits || 0
        });
      }
    }
  }

  // 3. Check if identifier is a Fetcher
  if (identifier && password) {
    const fetcher = storage.findFetcher(identifier);
    if (fetcher) {
      const match = await storage.comparePassword(password, fetcher.passwordHash || fetcher.plainPassword);
      if (match) {
        return res.json({
          status: 'success',
          role: 'fetcher',
          username: fetcher.username,
          permission_days: fetcher.permission_days || 30
        });
      }
    }
  }

  return res.status(403).json({
    status: 'error',
    message: 'Invalid username, password, or Master Key'
  });
}

async function verifyAdmin(req, res) {
  return res.json({
    status: 'success',
    message: 'Master Admin verified'
  });
}

async function subadminLogin(req, res) {
  const sub = req.reseller;
  return res.json({
    status: 'success',
    role: 'sub_admin',
    username: sub.username,
    credits: sub.credits || 0
  });
}

async function fetcherLogin(req, res) {
  const fetcher = req.fetcher;
  return res.json({
    status: 'success',
    role: 'fetcher',
    username: fetcher.username,
    permission_days: fetcher.permission_days || 30
  });
}

module.exports = {
  unifiedLogin,
  verifyAdmin,
  subadminLogin,
  fetcherLogin
};
