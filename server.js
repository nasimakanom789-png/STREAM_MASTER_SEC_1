const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./server/config/config');
const storage = require('./server/db/storage');

const authRoutes = require('./server/routes/authRoutes');
const adminRoutes = require('./server/routes/adminRoutes');
const resellerRoutes = require('./server/routes/resellerRoutes');
const fetcherRoutes = require('./server/routes/fetcherRoutes');

const app = express();

// Security & Body Parsers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Endpoints
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/subadmin', resellerRoutes);
app.use('/fetcher', fetcherRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'STREAM CORPORATION Ops Deck',
    version: config.appVersion,
    timestamp: new Date().toISOString()
  });
});

// Single Page Application Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error occurred'
  });
});

// Initialize Storage and Start Server
async function bootstrap() {
  try {
    await storage.init();
    app.listen(config.port, () => {
      console.log('====================================================');
      console.log(`  STREAM CORPORATION — Ops Deck (${config.appVersion})`);
      console.log(`  Server running on http://localhost:${config.port}`);
      console.log(`  Master Key: ${storage.getMasterAdminKey()}`);
      console.log('====================================================');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
