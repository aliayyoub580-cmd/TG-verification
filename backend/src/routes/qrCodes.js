const express = require('express');
const Joi = require('joi');
const { requireAdmin } = require('../middleware/auth');
const { uploadCSV } = require('../middleware/upload');
const { validateBody } = require('../middleware/validate');
const ctrl = require('../controllers/qrCodeController');

const router = express.Router();
router.use(requireAdmin);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createQRSchema = Joi.object({
  code: Joi.string().min(4).max(64).uppercase().required(),
  product_id: Joi.string().uuid().required(),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

const updateQRSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive').optional(),
  product_id: Joi.string().uuid().optional(),
});

const generateSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).max(50000).required(),
  codeLength: Joi.number().integer().min(6).max(32).default(10),
  prefix: Joi.string().max(8).allow('', null).default('').optional(),
  status: Joi.string().valid('active', 'inactive').default('active'),
  baseUrl: Joi.string().uri().optional(),
  confirmDomain: Joi.boolean().optional(),
});

const bulkStatusSchema = Joi.object({
  ids: Joi.array().items(Joi.string().uuid()).min(1).max(1000).required(),
  status: Joi.string().valid('active', 'inactive').required(),
});

const bulkDeleteSchema = Joi.object({
  ids: Joi.array().items(Joi.string().uuid()).min(1).max(1000).required(),
});

const downloadZipSchema = Joi.object({
  ids: Joi.array().items(Joi.string().uuid()).min(1).max(20000).required(),
  productName: Joi.string().optional(),
  baseUrl: Joi.string().uri().optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// Generation batches
router.get('/generation-batches', ctrl.getGenerationBatches);
router.get('/generation-batches/:id', ctrl.getGenerationBatch);

// Bulk operations — must come before /:id routes
router.patch('/bulk-status', validateBody(bulkStatusSchema), ctrl.bulkStatus);
router.delete('/bulk-delete', validateBody(bulkDeleteSchema), ctrl.bulkDelete);

// Generate
router.post('/generate', validateBody(generateSchema), ctrl.generate);

// Import/Export
router.get('/export', ctrl.exportCodes);
router.get('/template', ctrl.downloadTemplate);
router.post('/preview-import', uploadCSV.single('file'), ctrl.previewImport);
router.post('/import', uploadCSV.single('file'), ctrl.importCodes);

// ZIP download
router.post('/download-zip', validateBody(downloadZipSchema), ctrl.downloadZip);

// QR image preview
router.get('/:id/qr-preview', ctrl.getQRPreview);

// CRUD
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', validateBody(createQRSchema), ctrl.create);
router.put('/:id', validateBody(updateQRSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
