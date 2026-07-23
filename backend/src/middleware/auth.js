const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');

/**
 * Verifies the JWT sent as a Bearer token.
 * Also validates that the user exists and has an admin_profile row.
 */
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid authentication token' });
    }

    // Verify the user still exists and is an admin
    const { data: profile, error } = await supabaseAdmin
      .from('admin_profiles')
      .select('id, full_name, role')
      .eq('id', decoded.userId)
      .single();

    if (error || !profile) {
      return res.status(401).json({ success: false, message: 'Admin profile not found. Access denied.' });
    }

    req.admin = {
      id: decoded.userId,
      email: decoded.email,
      fullName: profile.full_name,
      role: profile.role,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
}

module.exports = { requireAdmin };
