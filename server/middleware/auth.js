const storage = require('../db/storage');

async function verifyMasterAdmin(req, res, next) {
  const adminKey = req.body.admin_key || req.query.admin_key;
  const currentKey = storage.getMasterAdminKey();

  if (!adminKey || adminKey !== currentKey) {
    return res.status(403).json({
      status: 'error',
      message: 'Unauthorized: Invalid Master Admin Key'
    });
  }
  next();
}

async function verifyReseller(req, res, next) {
  const username = req.body.username || req.query.username;
  const password = req.body.password || req.query.password;

  if (!username || !password) {
    return res.status(403).json({
      status: 'error',
      message: 'Unauthorized: Username and Password required'
    });
  }

  const sub = storage.findSubadmin(username);
  if (!sub) {
    return res.status(403).json({
      status: 'error',
      message: 'Unauthorized: Reseller account not found'
    });
  }

  const isMatch = await storage.comparePassword(password, sub.passwordHash || sub.plainPassword);
  if (!isMatch) {
    return res.status(403).json({
      status: 'error',
      message: 'Unauthorized: Invalid credentials'
    });
  }

  req.reseller = sub;
  next();
}

async function verifyFetcher(req, res, next) {
  const username = req.body.username || req.query.username;
  const password = req.body.password || req.query.password;

  if (!username || !password) {
    return res.status(403).json({
      status: 'error',
      message: 'Unauthorized: Username and Password required'
    });
  }

  const fetcher = storage.findFetcher(username);
  if (!fetcher) {
    return res.status(403).json({
      status: 'error',
      message: 'Unauthorized: Fetcher account not found'
    });
  }

  const isMatch = await storage.comparePassword(password, fetcher.passwordHash || fetcher.plainPassword);
  if (!isMatch) {
    return res.status(403).json({
      status: 'error',
      message: 'Unauthorized: Invalid credentials'
    });
  }

  req.fetcher = fetcher;
  next();
}

module.exports = {
  verifyMasterAdmin,
  verifyReseller,
  verifyFetcher
};
