const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyMasterAdmin } = require('../middleware/auth');

router.use(verifyMasterAdmin);

router.get('/list', adminController.listLicenses);
router.post('/create', adminController.createLicense);
router.post('/update', adminController.updateLicense);
router.post('/revoke', adminController.revokeLicense);

router.get('/list-subadmins', adminController.listSubadmins);
router.post('/create-subadmin', adminController.createSubadmin);
router.post('/give-credits', adminController.giveCredits);
router.post('/delete-subadmin', adminController.deleteSubadmin);

router.get('/list-fetchers', adminController.listFetchers);
router.post('/create-fetcher', adminController.createFetcher);
router.post('/update-fetcher-permission', adminController.updateFetcherPermission);
router.post('/delete-fetcher', adminController.deleteFetcher);

router.post('/change-key', adminController.changeMasterKey);
router.get('/db-status', adminController.dbStatus);

module.exports = router;
