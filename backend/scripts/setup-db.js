/**
 * Database setup script — runs migrations and creates admin user.
 * Run: node scripts/setup-db.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Run SQL via Supabase SQL API (pg endpoint) ────────────────────────────────
async function runSQL(label, sql) {
  console.log(`\n▶  ${label}...`);
  const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

  const res = await fetch(
    `https://${projectRef}.supabase.co/rest/v1/rpc/query`,
    {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    // RPC not available — use direct pg URL
    return false;
  }
  console.log(`   ✓ ${label} complete`);
  return true;
}

// ── Create tables using individual Supabase client calls ─────────────────────
async function createTablesManually() {
  console.log('\n▶  Creating tables via Supabase...');

  // Test if tables already exist
  const { error: testError } = await supabase
    .from('products')
    .select('id')
    .limit(1);

  if (!testError) {
    console.log('   ✓ Tables already exist');
    return true;
  }

  console.log('   Tables do not exist yet.');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ACTION REQUIRED: Run this SQL in your Supabase SQL Editor:');
  console.log('  Dashboard → SQL Editor → paste contents of:');
  console.log('  backend/database/migrations/001_initial_schema.sql');
  console.log('  backend/database/migrations/002_seed_default_product.sql');
  console.log('  backend/database/migrations/003_storage_buckets.sql');
  console.log('  backend/database/migrations/004_qr_code_batch_number.sql');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  return false;
}

// ── Create admin user ─────────────────────────────────────────────────────────
async function createAdminUser(email, password) {
  console.log(`\n▶  Creating admin user: ${email}...`);

  // Check if user already exists
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('   ERROR listing users:', listError.message);
    return null;
  }

  let userId;
  const existing = listData.users.find((u) => u.email === email);

  if (existing) {
    console.log('   User already exists, updating password...');
    const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(
      existing.id,
      { password, email_confirm: true }
    );
    if (updateError) {
      console.error('   ERROR updating user:', updateError.message);
      return null;
    }
    userId = existing.id;
    console.log(`   ✓ Password updated for existing user: ${userId}`);
  } else {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('   ERROR creating user:', authError.message);
      return null;
    }
    userId = authData.user.id;
    console.log(`   ✓ Auth user created: ${userId}`);
  }

  return userId;
}

// ── Create admin profile ──────────────────────────────────────────────────────
async function createAdminProfile(userId) {
  console.log('\n▶  Creating admin profile...');

  const { error } = await supabase
    .from('admin_profiles')
    .upsert(
      { id: userId, full_name: 'Administrator', role: 'admin' },
      { onConflict: 'id' }
    );

  if (error) {
    console.error('   ERROR:', error.message);
    console.log('\n   If tables are not created yet, run the SQL migrations first,');
    console.log('   then run this script again.');
    return false;
  }

  console.log('   ✓ Admin profile saved');
  return true;
}

// ── Seed default product ──────────────────────────────────────────────────────
async function seedDefaultProduct() {
  console.log('\n▶  Checking default product...');

  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('name', 'T.G. 15 mg')
    .eq('company_name', 'Indufar')
    .maybeSingle();

  if (existing) {
    console.log('   ✓ Default product already exists');
    return;
  }

  const { error } = await supabase.from('products').insert({
    name: 'T.G. 15 mg',
    medicine_name: 'Tirzepatida',
    dosage: '15 mg/0.5mL',
    description: 'Tirzepatida 15 mg/0.5mL — Injectable solution for subcutaneous use.',
    company_name: 'Indufar',
    success_message: "This code matches our records. Compare it with the code printed on your product's packaging.",
    footer_text: 'Secured verification · Powered by Indufar',
    status: 'active',
  });

  if (error) {
    console.error('   ERROR seeding product:', error.message);
  } else {
    console.log('   ✓ Default product created: T.G. 15 mg');
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Indufar QR System — Database Setup');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Project: ${SUPABASE_URL}`);

  // 1. Check/create tables
  const tablesOk = await createTablesManually();

  // 2. Create admin user (always do this regardless of tables)
  const userId = await createAdminUser('admin@gmail.com', 'admin123');

  if (tablesOk && userId) {
    // 3. Create admin profile
    const profileOk = await createAdminProfile(userId);

    // 4. Seed default product
    if (profileOk) {
      await seedDefaultProduct();
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  if (userId) {
    console.log('  ADMIN CREDENTIALS');
    console.log('  Email   : admin@gmail.com');
    console.log('  Password: admin123');
    console.log('  Login   : http://localhost:5173/admin/login');
  }
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
