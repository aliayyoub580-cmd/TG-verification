const express = require('express');
const Joi = require('joi');
const { requireAdmin } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const { validateBody } = require('../middleware/validate');
const ctrl = require('../controllers/productController');

const router = express.Router();

// All routes require admin auth
router.use(requireAdmin);

const productSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  medicine_name: Joi.string().max(200).allow('', null).optional(),
  dosage: Joi.string().max(100).allow('', null).optional(),
  description: Joi.string().max(2000).allow('', null).optional(),
  company_name: Joi.string().min(1).max(200).required(),
  success_message: Joi.string().max(500).allow('', null).optional(),
  footer_text: Joi.string().max(200).allow('', null).optional(),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

const updateSchema = Joi.object({
  name: Joi.string().min(1).max(200).optional(),
  medicine_name: Joi.string().max(200).allow('', null).optional(),
  dosage: Joi.string().max(100).allow('', null).optional(),
  description: Joi.string().max(2000).allow('', null).optional(),
  company_name: Joi.string().min(1).max(200).optional(),
  success_message: Joi.string().max(500).allow('', null).optional(),
  footer_text: Joi.string().max(200).allow('', null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
});

const uploadFields = uploadImage.fields([
  { name: 'product_image', maxCount: 1 },
  { name: 'company_logo', maxCount: 1 },
]);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', uploadFields, validateBody(productSchema), ctrl.create);
router.put('/:id', uploadFields, validateBody(updateSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
