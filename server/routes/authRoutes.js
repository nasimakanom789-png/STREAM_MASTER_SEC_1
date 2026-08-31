const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyMasterAdmin, verifyReseller, verifyFetcher } = require('../middleware/auth');

router.post('/unified/login', authController.unifiedLogin);
router.post('/admin/verify', verifyMasterAdmin, authController.verifyAdmin);
router.post('/subadmin/login', verifyReseller, authController.subadminLogin);
router.post('/fetcher/login', verifyFetcher, authController.fetcherLogin);

module.exports = router;
