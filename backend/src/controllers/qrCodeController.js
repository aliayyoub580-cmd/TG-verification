const qrCodeService = require('../services/qrCodeService');
const { generateQRCodes, getBatchDetails, listBatches } = require('../services/generateService');
const { exportQRCodes, previewCSVImport, importCSV, getCSVTemplate } = require('../services/importExportService');
const { streamQRZip } = require('../services/zipService');
const { paginatedResponse } = require('../utils/pagination');
const { generateQRDataURL, buildVerificationUrl } = require('../utils/qrGenerator');

// ─── QR CODES CRUD ────────────────────────────────────────────────────────────

async function list(req, res, next) {
  try {
    const { data, total, page, limit } = await qrCodeService.listQRCodes(req.query);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const qrCode = await qrCodeService.getQRCodeById(req.params.id);
    res.json({ success: true, data: qrCode });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const qrCode = await qrCodeService.createQRCode(req.body);
    res.status(201).json({ success: true, data: qrCode });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const qrCode = await qrCodeService.updateQRCode(req.params.id, req.body);
    res.json({ success: true, data: qrCode });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await qrCodeService.deleteQRCode(req.params.id);
    res.json({ success: true, message: 'QR code deleted' });
  } catch (err) {
    next(err);
  }
}

// ─── BULK OPERATIONS ──────────────────────────────────────────────────────────

async function bulkStatus(req, res, next) {
  try {
    const { ids, status } = req.body;
    const result = await qrCodeService.bulkUpdateStatus(ids, status);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function bulkDelete(req, res, next) {
  try {
    const { ids } = req.body;
    const result = await qrCodeService.bulkDelete(ids);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── GENERATION ───────────────────────────────────────────────────────────────

async function generate(req, res, next) {
  try {
    const baseUrl =
      req.body.baseUrl ||
      process.env.PUBLIC_VERIFICATION_BASE_URL ||
      'https://indufar-verification.vercel.app';

    const result = await generateQRCodes({
      productId: req.body.productId,
      quantity: parseInt(req.body.quantity, 10),
      codeLength: parseInt(req.body.codeLength, 10) || 10,
      prefix: req.body.prefix || '',
      status: req.body.status || 'active',
      baseUrl,
      adminId: req.admin.id,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getGenerationBatches(req, res, next) {
  try {
    const { data, total, page, limit } = await listBatches(req.query);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
}

async function getGenerationBatch(req, res, next) {
  try {
    const batch = await getBatchDetails(req.params.id);
    res.json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

// ─── IMPORT / EXPORT ─────────────────────────────────────────────────────────

async function exportCodes(req, res, next) {
  try {
    const baseUrl =
      req.query.baseUrl ||
      process.env.PUBLIC_VERIFICATION_BASE_URL ||
      'https://indufar-verification.vercel.app';

    const csv = await exportQRCodes(
      {
        status: req.query.status,
        product_id: req.query.product_id,
        batch_id: req.query.batch_id,
        ids: req.query.ids ? req.query.ids.split(',') : undefined,
      },
      baseUrl
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="qr-codes-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

async function previewImport(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
    }
    const preview = await previewCSVImport(req.file.buffer);
    res.json({ success: true, data: preview });
  } catch (err) {
    next(err);
  }
}

async function importCodes(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
    }

    const skipDuplicates = req.body.skipDuplicates !== 'false';
    const result = await importCSV(req.file.buffer, skipDuplicates);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function downloadTemplate(req, res) {
  const buffer = getCSVTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="qr-import-template.csv"');
  res.send(buffer);
}

// ─── ZIP DOWNLOAD ─────────────────────────────────────────────────────────────

async function downloadZip(req, res, next) {
  try {
    const { ids, productName } = req.body;
    const baseUrl =
      req.body.baseUrl ||
      process.env.PUBLIC_VERIFICATION_BASE_URL ||
      'https://indufar-verification.vercel.app';

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No QR code IDs provided' });
    }

    await streamQRZip(res, { codeIds: ids, baseUrl, productName });
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    }
  }
}

// ─── QR IMAGE PREVIEW ────────────────────────────────────────────────────────

async function getQRPreview(req, res, next) {
  try {
    const qrCode = await qrCodeService.getQRCodeById(req.params.id);

    const baseUrl =
      req.query.baseUrl ||
      process.env.PUBLIC_VERIFICATION_BASE_URL ||
      'https://indufar-verification.vercel.app';

    const url = buildVerificationUrl(qrCode.code, baseUrl);
    const dataUrl = await generateQRDataURL(url);

    res.json({ success: true, data: { dataUrl, verificationUrl: url } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list, getOne, create, update, remove,
  bulkStatus, bulkDelete,
  generate, getGenerationBatches, getGenerationBatch,
  exportCodes, previewImport, importCodes, downloadTemplate,
  downloadZip, getQRPreview,
};
