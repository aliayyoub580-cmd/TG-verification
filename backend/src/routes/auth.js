const express = require('express');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const { login, logout, me } = require('../controllers/authController');
const { requireAdmin } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { ADMIN_LOGIN_WINDOW_MS, ADMIN_LOGIN_MAX_REQUESTS } = require('../config/constants');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: ADMIN_LOGIN_WINDOW_MS,
  max: ADMIN_LOGIN_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes and try again.',
  },
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'any.required': 'Password is required',
  }),
});

router.post('/login', loginLimiter, validateBody(loginSchema), login);
router.post('/logout', requireAdmin, logout);
router.get('/me', requireAdmin, me);

module.exports = router;
