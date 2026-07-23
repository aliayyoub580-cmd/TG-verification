const express = require('express');
const rateLimit = require('express-rate-limit');
const { verify } = require('../controllers/verifyController');
const {
  PUBLIC_VERIFY_WINDOW_MS,
  PUBLIC_VERIFY_MAX_REQUESTS,
} = require('../config/constants');

const router = express.Router();

// Rate limit — 30 requests per minute per IP
const verifyLimiter = rateLimit({
  windowMs: PUBLIC_VERIFY_WINDOW_MS,
  max: PUBLIC_VERIFY_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification requests. Please wait a moment and try again.',
  },
  keyGenerator: (req) => req.ip,
});

/**
 * GET /api/verify?code=7GG6Y89U8K
 * Public endpoint — no authentication required
 */
router.get('/', verifyLimiter, verify);

module.exports = router;
