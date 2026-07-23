const jwt = require('jsonwebtoken');
const { supabaseAdmin, supabaseAuth } = require('../config/supabase');

/**
 * Authenticates an admin user using Supabase Auth.
 * Returns a signed JWT that the frontend stores for subsequent requests.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, admin: object }>}
 */
async function loginAdmin(email, password) {
  // 1. Authenticate with Supabase Auth
  const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });

  if (authError || !authData?.user) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  const userId = authData.user.id;

  // 2. Verify there is an admin_profiles row
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('admin_profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw Object.assign(
      new Error('Access denied. This account does not have admin privileges.'),
      { statusCode: 403 }
    );
  }

  // 3. Issue our own JWT (so the service-role key never leaves the backend)
  const token = jwt.sign(
    { userId, email: authData.user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  return {
    token,
    admin: {
      id: userId,
      email: authData.user.email,
      fullName: profile.full_name,
      role: profile.role,
    },
  };
}

/**
 * Retrieves the admin profile for the authenticated user.
 */
async function getAdminProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('admin_profiles')
    .select('id, full_name, role, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw Object.assign(new Error('Admin profile not found'), { statusCode: 404 });
  }

  return data;
}

module.exports = { loginAdmin, getAdminProfile };
