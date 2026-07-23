const { verifyCode } = require('../services/verifyService');

async function verify(req, res, next) {
  try {
    const rawCode = req.query.code;

    const meta = {
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
      referrer: req.headers.referer || req.headers.referrer || null,
    };

    const result = await verifyCode(rawCode, meta);

    // HTTP status: 200 for found (even inactive), 404 for not found
    const statusCode =
      result.status === 'authentic' || result.status === 'inactive' ? 200 :
      result.status === 'not_found' ? 404 : 400;

    res.status(statusCode).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { verify };
