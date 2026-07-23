-- ============================================================
-- Indufar QR Product Verification System
-- Database Migration 001 - Initial Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PRODUCTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  medicine_name     TEXT,
  dosage            TEXT,
  description       TEXT,
  product_image_url TEXT,
  company_logo_url  TEXT,
  company_name      TEXT NOT NULL,
  success_message   TEXT,
  footer_text       TEXT,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT products_status_check CHECK (status IN ('active', 'inactive'))
);

-- ─── GENERATION BATCHES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generation_batches (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID REFERENCES products(id) ON DELETE SET NULL,
  requested_quantity  INTEGER NOT NULL,
  generated_quantity  INTEGER NOT NULL DEFAULT 0,
  failed_quantity     INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending',
  base_url            TEXT NOT NULL,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,

  CONSTRAINT generation_batches_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial'))
);

-- ─── QR CODES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qr_codes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                  TEXT UNIQUE NOT NULL,
  product_id            UUID REFERENCES products(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'active',
  scan_count            INTEGER NOT NULL DEFAULT 0,
  first_scanned_at      TIMESTAMPTZ,
  last_scanned_at       TIMESTAMPTZ,
  generation_batch_id   UUID REFERENCES generation_batches(id) ON DELETE SET NULL,
  batch_number          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT qr_codes_status_check CHECK (status IN ('active', 'inactive'))
);

-- ─── SCAN LOGS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_code_id          UUID REFERENCES qr_codes(id) ON DELETE SET NULL,
  submitted_code      TEXT,
  verification_result TEXT NOT NULL,
  ip_address          TEXT,
  user_agent          TEXT,
  referrer            TEXT,
  scanned_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT scan_logs_result_check
    CHECK (verification_result IN ('authentic', 'inactive', 'not_found', 'missing_code'))
);

-- ─── ADMIN PROFILES ─────────────────────────────────────────────────────────
-- Links to Supabase auth.users
CREATE TABLE IF NOT EXISTS admin_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT admin_profiles_role_check CHECK (role IN ('admin', 'superadmin'))
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_qr_codes_code          ON qr_codes(code);
CREATE INDEX IF NOT EXISTS idx_qr_codes_product_id    ON qr_codes(product_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_status        ON qr_codes(status);
CREATE INDEX IF NOT EXISTS idx_qr_codes_batch_id      ON qr_codes(generation_batch_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_created_at    ON qr_codes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_logs_qr_code_id   ON scan_logs(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_submitted    ON scan_logs(submitted_code);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at   ON scan_logs(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_logs_result       ON scan_logs(verification_result);
CREATE INDEX IF NOT EXISTS idx_generation_batches_product ON generation_batches(product_id);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_qr_codes_updated_at
  BEFORE UPDATE ON qr_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles     ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "service_role_all_products"           ON products;
DROP POLICY IF EXISTS "service_role_all_qr_codes"           ON qr_codes;
DROP POLICY IF EXISTS "service_role_all_generation_batches" ON generation_batches;
DROP POLICY IF EXISTS "service_role_all_scan_logs"          ON scan_logs;
DROP POLICY IF EXISTS "service_role_all_admin_profiles"     ON admin_profiles;

-- The backend uses the SERVICE ROLE key — grant it full access
-- Public (anon) users get NO direct table access; all public verification
-- goes through the Express API using the service role.

CREATE POLICY "service_role_all_products"
  ON products
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_qr_codes"
  ON qr_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_generation_batches"
  ON generation_batches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_scan_logs"
  ON scan_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_admin_profiles"
  ON admin_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin users can read their own profile (needed for Supabase auth.signInWithPassword)
CREATE POLICY "admin_read_own_profile"
  ON admin_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
