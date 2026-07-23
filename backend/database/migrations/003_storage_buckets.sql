-- ============================================================
-- Supabase Storage Bucket Setup
-- Run in Supabase SQL Editor OR via the Supabase Dashboard
-- ============================================================

-- Create product-images bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Create company-logos bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: service role can do everything
DROP POLICY IF EXISTS "service_role_product_images" ON storage.objects;
DROP POLICY IF EXISTS "service_role_company_logos"  ON storage.objects;
DROP POLICY IF EXISTS "public_read_product_images"  ON storage.objects;
DROP POLICY IF EXISTS "public_read_company_logos"   ON storage.objects;

-- Allow public to read (view) images
CREATE POLICY "public_read_product_images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

CREATE POLICY "public_read_company_logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'company-logos');

-- Allow service role full access (backend uploads/deletes)
CREATE POLICY "service_role_product_images"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "service_role_company_logos"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'company-logos')
  WITH CHECK (bucket_id = 'company-logos');
