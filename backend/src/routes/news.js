const express = require('express');
const { param, validationResult } = require('express-validator');
const { requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/newsController');

const router = express.Router();
router.use(requireAdmin);

const validateId = [
  param('id').isUUID().withMessage('Invalid news article ID'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, message: 'Invalid news article ID' });
    next();
  },
];

router.get('/', controller.list);
router.post('/refresh', controller.refresh);
router.get('/:id', validateId, controller.getOne);
router.delete('/:id', validateId, controller.remove);

module.exports = router;
