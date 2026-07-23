module.exports = {
  // Code generation
  // Characters to use — uppercase, no O/0 or I/1 confusion

  // Batch processing
  DB_INSERT_BATCH_SIZE: 500,
  QR_GENERATE_BATCH_SIZE: 100,

  // File upload limits
  MAX_IMAGE_SIZE_MB: 5,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],

  // CSV limits
  MAX_CSV_ROWS: 50000,
  CSV_IMPORT_BATCH_SIZE: 500,

  // Rate limiting
  PUBLIC_VERIFY_WINDOW_MS: 60 * 1000,       // 1 minute
  PUBLIC_VERIFY_MAX_REQUESTS: 30,            // per IP per minute
  ADMIN_LOGIN_WINDOW_MS: 15 * 60 * 1000,    // 15 minutes
  ADMIN_LOGIN_MAX_REQUESTS: 10,

  // Supabase Storage buckets
  PRODUCT_IMAGES_BUCKET: 'product-images',
  COMPANY_LOGOS_BUCKET: 'company-logos',
  QR_CODES_BUCKET: 'qr-codes',

  // Verification results
  RESULT_AUTHENTIC: 'authentic',
  RESULT_INACTIVE: 'inactive',
  RESULT_NOT_FOUND: 'not_found',
  RESULT_MISSING_CODE: 'missing_code',

  // QR code status values
  STATUS_ACTIVE: 'active',
  STATUS_INACTIVE: 'inactive',

  // Batch status values
  BATCH_STATUS_PENDING: 'pending',
  BATCH_STATUS_PROCESSING: 'processing',
  BATCH_STATUS_COMPLETED: 'completed',
  BATCH_STATUS_FAILED: 'failed',
  BATCH_STATUS_PARTIAL: 'partial',
};
