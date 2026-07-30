const express = require('express');
const crypto = require('crypto');
const { refreshNews } = require('../services/newsService');

const router = express.Router();

router.get('/news', async (req, res, next) => {
  try {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      console.warn('[CRON] News refresh attempted but CRON_SECRET is not defined in environment variables.');
    }
    const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const expectedBuffer = Buffer.from(expected || '');
    const suppliedBuffer = Buffer.from(supplied || '');
    const valid = expectedBuffer.length > 0 &&
      expectedBuffer.length === suppliedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: expected ? 'Unauthorized: Invalid cron secret token' : 'Unauthorized: CRON_SECRET is not configured on server',
      });
    }
    const result = await refreshNews();
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

module.exports = router;
