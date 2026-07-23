-- Store the human-readable batch number supplied by CSV imports.
ALTER TABLE qr_codes
  ADD COLUMN IF NOT EXISTS batch_number TEXT;

CREATE INDEX IF NOT EXISTS idx_qr_codes_batch_number
  ON qr_codes(batch_number);

-- Make the new column visible to the REST API immediately.
NOTIFY pgrst, 'reload schema';
