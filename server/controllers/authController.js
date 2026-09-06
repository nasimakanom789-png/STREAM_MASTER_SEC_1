const storage = require('../db/storage');

async function unifiedLogin(req, res) {
  const identifier = (req.body.identifier || '').trim();
  const password = (req.body.password || '').trim();
  const tier = (req.body.tier || '').trim().toLowerCase();

  if (!identifier && !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Please enter your username or Master Secret Key'
    });
  }

  const currentMasterKey = storage.getMasterAdminKey();

  // Tier-specific dispatch if tier is explicitly provided
  if (tier === 'api-user' || tier === 'api_user') {
    if (identifier && password) {
      const apiUser = storage.findApiUser(identifier);
      if (apiUser) {
        const match = await storage.comparePassword(password, apiUser.passwordHash || apiUser.plainPassword);
        if (match) {
          return res.json({
            status: 'success',
            role: 'api_user',
            username: apiUser.username
          });
        }
      }
    }
    return res.status(403).json({
      status: 'error',
      message: 'Invalid API User credentials'
    });
  }

  if (tier === 'reseller' || tier === 'sub_admin') {
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
    return res.status(403).json({
      status: 'error',
      message: 'Invalid Reseller credentials'
    });
  }

  if (tier === 'fetcher') {
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
      message: 'Invalid Fetcher credentials'
    });
  }

  if (tier === 'master') {
    if (identifier === currentMasterKey || (password && password === currentMasterKey)) {
      return res.json({
        status: 'success',
        role: 'main_admin',
        admin_key: currentMasterKey
      });
    }
    return res.status(403).json({
      status: 'error',
      message: 'Invalid Master Secret Key'
    });
  }

  // Fallback Auto-Detection if no tier is passed:
  // 1. Master Key
  if (identifier === currentMasterKey || (password && password === currentMasterKey)) {
    return res.json({
      status: 'success',
      role: 'main_admin',
      admin_key: currentMasterKey
    });
  }

  // 2. API Console User
  if (identifier && password) {
    const apiUser = storage.findApiUser(identifier);
    if (apiUser) {
      const match = await storage.comparePassword(password, apiUser.passwordHash || apiUser.plainPassword);
      if (match) {
        return res.json({
          status: 'success',
          role: 'api_user',
          username: apiUser.username
        });
      }
    }
  }

  // 3. Reseller (Sub-Admin)
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

  // 4. Fetcher
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
