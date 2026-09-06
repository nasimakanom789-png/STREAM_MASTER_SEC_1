const express = require('express');
const router = express.Router();
const licenseProxyController = require('../controllers/licenseProxyController');

// Status & Health
router.get('/status', (req, res) => licenseProxyController.getStatus(req, res));
router.get('/stats', (req, res) => licenseProxyController.getStats(req, res));

// License CRUD & Management
router.get('/', (req, res) => licenseProxyController.getLicenses(req, res));
router.post('/create', (req, res) => licenseProxyController.createLicense(req, res));
router.post('/ban', (req, res) => licenseProxyController.banLicense(req, res));
router.post('/unban', (req, res) => licenseProxyController.unbanLicense(req, res));
router.post('/reset-hwid', (req, res) => licenseProxyController.resetHwid(req, res));

// Single License Details by Key or ID (placed last to prevent capturing other routes)
router.get('/:keyOrId', (req, res) => licenseProxyController.getLicenseByKeyOrId(req, res));

module.exports = router;
