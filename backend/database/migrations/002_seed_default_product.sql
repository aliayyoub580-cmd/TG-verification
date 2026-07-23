-- ============================================================
-- Seed: Default Indufar Product
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- Insert the default T.G. 15 mg product (idempotent — skips if already exists)
INSERT INTO products (
  name,
  medicine_name,
  dosage,
  description,
  company_name,
  success_message,
  footer_text,
  status
)
SELECT
  'T.G. 15 mg',
  'Tirzepatida',
  '15 mg/0.5mL',
  'Tirzepatida 15 mg/0.5mL — Injectable solution for subcutaneous use.',
  'Indufar',
  'This code matches our records. Compare it with the code printed on your product''s packaging.',
  'Secured verification · Powered by Indufar',
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM products WHERE name = 'T.G. 15 mg' AND company_name = 'Indufar'
);
