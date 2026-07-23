const multer = require('multer');
const { MAX_IMAGE_SIZE_MB, ALLOWED_IMAGE_TYPES } = require('../config/constants');

// Store in memory — we'll upload to Supabase Storage from the buffer
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        'LIMIT_UNEXPECTED_FILE',
        `Only JPEG, PNG, WebP, or SVG images are allowed. Received: ${file.mimetype}`
      ),
      false
    );
  }
}

const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024,
  },
});

// CSV upload — memory storage, plain text
const csvStorage = multer.memoryStorage();
const uploadCSV = multer({
  storage: csvStorage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted.'), false);
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

module.exports = { uploadImage, uploadCSV };
