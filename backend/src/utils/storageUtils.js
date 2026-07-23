const { supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * Uploads a file buffer to Supabase Storage.
 *
 * @param {Buffer} buffer - File content
 * @param {string} bucket - Storage bucket name
 * @param {string} originalName - Original filename (used for extension)
 * @param {string} [folder] - Optional subfolder inside the bucket
 * @returns {Promise<string>} Public URL of the uploaded file
 */
async function uploadToStorage(buffer, bucket, originalName, folder = '') {
  const ext = path.extname(originalName).toLowerCase() || '.png';
  const fileName = `${uuidv4()}${ext}`;
  const filePath = folder ? `${folder}/${fileName}` : fileName;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType: getContentType(ext),
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to retrieve public URL after upload.');
  }

  return urlData.publicUrl;
}

/**
 * Deletes a file from Supabase Storage given its public URL.
 *
 * @param {string} bucket
 * @param {string} publicUrl
 */
async function deleteFromStorage(bucket, publicUrl) {
  try {
    // Extract the path portion after the bucket name
    const bucketPrefix = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(bucketPrefix);
    if (idx === -1) return;

    const filePath = decodeURIComponent(publicUrl.substring(idx + bucketPrefix.length));

    await supabaseAdmin.storage.from(bucket).remove([filePath]);
  } catch (err) {
    // Non-critical — log but don't throw
    console.warn('Storage delete warning:', err.message);
  }
}

function getContentType(ext) {
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

module.exports = { uploadToStorage, deleteFromStorage };
