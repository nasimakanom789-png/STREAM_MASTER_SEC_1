const express = require('express');
const router = express.Router();
const fetcherController = require('../controllers/fetcherController');
const { verifyFetcher } = require('../middleware/auth');

router.use(verifyFetcher);

router.get('/permission', fetcherController.getPermission);
router.get('/list', fetcherController.listLicenses);
router.post('/create', fetcherController.createLicense);
router.post('/update', fetcherController.updateLicense);
router.post('/revoke', fetcherController.revokeLicense);

module.exports = router;
