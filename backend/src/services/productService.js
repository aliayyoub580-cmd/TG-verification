const { supabaseAdmin } = require('../config/supabase');
const { uploadToStorage, deleteFromStorage } = require('../utils/storageUtils');
const { getPagination } = require('../utils/pagination');
const { PRODUCT_IMAGES_BUCKET, COMPANY_LOGOS_BUCKET } = require('../config/constants');

async function listProducts(query = {}) {
  const { page, limit, offset } = getPagination(query);
  const { search, status } = query;

  let q = supabaseAdmin
    .from('products')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    q = q.or(`name.ilike.%${search}%,medicine_name.ilike.%${search}%,company_name.ilike.%${search}%`);
  }

  if (status) {
    q = q.eq('status', status);
  }

  const { data, count, error } = await q;

  if (error) throw new Error(`Failed to list products: ${error.message}`);

  return { data: data || [], total: count || 0, page, limit };
}

async function getProductById(id) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  return data;
}

async function createProduct(body, files = {}) {
  const productData = {
    name: body.name,
    medicine_name: body.medicine_name || null,
    dosage: body.dosage || null,
    description: body.description || null,
    company_name: body.company_name,
    success_message: body.success_message || null,
    footer_text: body.footer_text || null,
    status: body.status || 'active',
  };

  // Handle image uploads
  if (files.product_image) {
    const file = files.product_image[0];
    productData.product_image_url = await uploadToStorage(
      file.buffer,
      PRODUCT_IMAGES_BUCKET,
      file.originalname,
      'products'
    );
  }

  if (files.company_logo) {
    const file = files.company_logo[0];
    productData.company_logo_url = await uploadToStorage(
      file.buffer,
      COMPANY_LOGOS_BUCKET,
      file.originalname,
      'logos'
    );
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .insert(productData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create product: ${error.message}`);

  return data;
}

async function updateProduct(id, body, files = {}) {
  // Verify product exists
  const existing = await getProductById(id);

  const updates = {};

  const allowedFields = [
    'name', 'medicine_name', 'dosage', 'description',
    'company_name', 'success_message', 'footer_text', 'status',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  // Handle new image uploads — delete old ones from storage
  if (files.product_image) {
    if (existing.product_image_url) {
      await deleteFromStorage(PRODUCT_IMAGES_BUCKET, existing.product_image_url);
    }
    const file = files.product_image[0];
    updates.product_image_url = await uploadToStorage(
      file.buffer,
      PRODUCT_IMAGES_BUCKET,
      file.originalname,
      'products'
    );
  }

  if (files.company_logo) {
    if (existing.company_logo_url) {
      await deleteFromStorage(COMPANY_LOGOS_BUCKET, existing.company_logo_url);
    }
    const file = files.company_logo[0];
    updates.company_logo_url = await uploadToStorage(
      file.buffer,
      COMPANY_LOGOS_BUCKET,
      file.originalname,
      'logos'
    );
  }

  if (Object.keys(updates).length === 0) {
    throw Object.assign(new Error('No valid fields to update'), { statusCode: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update product: ${error.message}`);

  return data;
}

async function deleteProduct(id) {
  // Check for related QR codes
  const { count, error: countError } = await supabaseAdmin
    .from('qr_codes')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', id);

  if (countError) throw new Error(`Failed to check related QR codes: ${countError.message}`);

  if (count > 0) {
    throw Object.assign(
      new Error(
        `Cannot delete product: it has ${count} associated QR code(s). ` +
        'Please delete or reassign the QR codes first.'
      ),
      { statusCode: 409 }
    );
  }

  // Get existing product for storage cleanup
  const existing = await getProductById(id);

  const { error } = await supabaseAdmin
    .from('products')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete product: ${error.message}`);

  // Clean up storage files
  if (existing.product_image_url) {
    await deleteFromStorage(PRODUCT_IMAGES_BUCKET, existing.product_image_url);
  }
  if (existing.company_logo_url) {
    await deleteFromStorage(COMPANY_LOGOS_BUCKET, existing.company_logo_url);
  }

  return { deleted: true };
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
