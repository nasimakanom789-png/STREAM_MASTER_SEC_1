const express = require('express');
const router = express.Router();
const resellerController = require('../controllers/resellerController');
const { verifyReseller } = require('../middleware/auth');

router.use(verifyReseller);

router.get('/credits', resellerController.getCredits);
router.get('/list', resellerController.listLicenses);
router.post('/create', resellerController.createLicense);
router.post('/update', resellerController.updateLicense);
router.post('/revoke', resellerController.revokeLicense);

module.exports = router;
