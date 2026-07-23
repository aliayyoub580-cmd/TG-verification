const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/scanController');

const router = express.Router();
router.use(requireAdmin);

router.get('/dashboard', ctrl.dashboard);
router.get('/export', ctrl.exportHistory);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

module.exports = router;
