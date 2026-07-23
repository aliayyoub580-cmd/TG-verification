-- Client-supplied verification codes and persisted QR image workflow.
-- Safe to run on an existing database; no rows are deleted.

CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  total_codes INTEGER NOT NULL DEFAULT 0,
  successful_codes INTEGER NOT NULL DEFAULT 0,
  duplicate_codes INTEGER NOT NULL DEFAULT 0,
  failed_codes INTEGER NOT NULL DEFAULT 0,
  imported_by UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS code_normalized TEXT,
  ADD COLUMN IF NOT EXISTS qr_generated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS qr_image_url TEXT,
  ADD COLUMN IF NOT EXISTS qr_image_path TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS qr_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imported_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qr_generation_state TEXT NOT NULL DEFAULT 'pending';

UPDATE qr_codes
SET code_normalized = UPPER(BTRIM(code))
WHERE code_normalized IS NULL;

ALTER TABLE qr_codes ALTER COLUMN code_normalized SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_generation_state_check
    CHECK (qr_generation_state IN ('pending', 'processing', 'generated'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_codes_code_normalized
  ON qr_codes(code_normalized);
CREATE INDEX IF NOT EXISTS idx_qr_codes_pending
  ON qr_codes(qr_generated, imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_codes_generated_at
  ON qr_codes(qr_generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_codes_import_batch
  ON qr_codes(imported_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_imported_at
  ON import_batches(imported_at DESC);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_import_batches" ON import_batches;
CREATE POLICY "service_role_all_import_batches" ON import_batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- The backend uploads PNGs with the service role. Public URLs are used only
-- for administrator previews/downloads; verification itself queries the DB.
INSERT INTO storage.buckets (id, name, public)
VALUES ('qr-codes', 'qr-codes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public_read_qr_codes" ON storage.objects;
CREATE POLICY "public_read_qr_codes" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'qr-codes');
DROP POLICY IF EXISTS "service_role_manage_qr_codes" ON storage.objects;
CREATE POLICY "service_role_manage_qr_codes" ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'qr-codes')
  WITH CHECK (bucket_id = 'qr-codes');

NOTIFY pgrst, 'reload schema';
