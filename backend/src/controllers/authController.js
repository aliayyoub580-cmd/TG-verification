const { loginAdmin, getAdminProfile } = require('../services/authService');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await loginAdmin(email, password);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  // JWT is stateless — client discards the token
  res.json({ success: true, message: 'Logged out successfully' });
}

async function me(req, res, next) {
  try {
    const profile = await getAdminProfile(req.admin.id);
    res.json({ success: true, admin: { ...req.admin, ...profile } });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me };
