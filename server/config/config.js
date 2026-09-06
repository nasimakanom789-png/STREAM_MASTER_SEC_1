const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  masterAdminKey: process.env.MASTER_ADMIN_KEY || 'STREAM_MASTER_SEC_2026',
  mongoUri: process.env.MONGODB_URI || '',
  sessionSecret: process.env.SESSION_SECRET || 'stream_corp_ops_deck_key_2026',
  licenseApiBaseUrl: process.env.LICENSE_API_BASE_URL || 'http://194.233.76.156:10077/lib/api',
  appVersion: 'v7.0 Ops Deck'
};
