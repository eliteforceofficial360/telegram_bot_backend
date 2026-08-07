/**
 * uploadService.js — Elite Force Media Upload Service
 *
 * Centralized Cloudinary upload/delete module.
 * All upload endpoints in bot.js delegate here.
 *
 * Features:
 *  - Cloudinary streaming upload (upload_stream) for all media types
 *  - Exponential backoff retry (3 attempts)
 *  - Structured error objects with error codes
 *  - Folder-based organisation per asset type
 *  - Old asset deletion before replacement
 *  - Full metadata returned (secureUrl, publicId, width, height, bytes, format, etc.)
 */

import { v2 as cloudinary } from 'cloudinary';

// ── Initialise Cloudinary once at module load ─────────────────────────────────
// CLOUDINARY_URL format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
// The SDK reads CLOUDINARY_URL automatically if set as an environment variable.
// If not, fall back to individual vars.
if (!process.env.CLOUDINARY_URL && process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  // CLOUDINARY_URL is already in env — SDK self-configures
  cloudinary.config({ secure: true });
}

const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

// ── Folder map ─────────────────────────────────────────────────────────────────
const FOLDERS = {
  admin:    'uploads/admin',
  banner:   'uploads/banners',
  icon:     'uploads/icons',
  video:    'uploads/videos',
  task:     'uploads/tasks',
  profile:  'uploads/profile',
  branding: 'uploads/admin',
  default:  'uploads/admin',
};

/**
 * Returns the Cloudinary folder path for a given asset type.
 * @param {string} type  One of: admin | banner | icon | video | task | profile | branding
 */
export function getUploadFolder(type = 'default') {
  return FOLDERS[type] || FOLDERS.default;
}

// ── Structured error factory ──────────────────────────────────────────────────
function uploadError(code, message, detail = null) {
  const err = new Error(message);
  err.code = code;
  err.detail = detail;
  return err;
}

// ── Upload a base64 data URL to Cloudinary via upload_stream ──────────────────
/**
 * @param {string} dataUrl       Base64 data URL (data:image/... or data:video/...)
 * @param {object} options
 * @param {string} options.folder        Cloudinary folder path
 * @param {string} [options.publicId]    Cloudinary public_id (without extension)
 * @param {string} [options.oldPublicId] If set, delete this asset before uploading
 * @param {string} [options.oldResourceType] Resource type of old asset ('image'|'video'|'raw')
 * @param {boolean} [options.overwrite]  Default true
 * @returns {Promise<{secureUrl, publicId, resourceType, width, height, bytes, format, duration}>}
 */
export async function uploadToCloudinary(dataUrl, options = {}) {
  if (!isCloudinaryConfigured) {
    throw uploadError(
      'CLOUDINARY_NOT_CONFIGURED',
      'Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET environment variables.'
    );
  }

  if (!dataUrl || typeof dataUrl !== 'string') {
    throw uploadError('INVALID_INPUT', 'dataUrl must be a non-empty string.');
  }

  const isVideo = dataUrl.startsWith('data:video/');
  const isImage = dataUrl.startsWith('data:image/');
  if (!isVideo && !isImage) {
    throw uploadError('INVALID_MIME', 'Only image/* and video/* data URLs are supported.');
  }

  const resourceType = isVideo ? 'video' : 'image';
  const folder = options.folder || getUploadFolder(isVideo ? 'video' : 'branding');
  const publicId = options.publicId || `asset_${Date.now()}`;
  const overwrite = options.overwrite !== false;

  // Delete old asset before replacing
  if (options.oldPublicId) {
    await deleteFromCloudinary(
      options.oldPublicId,
      options.oldResourceType || resourceType
    ).catch((err) => {
      // Non-fatal — log and continue
      console.warn(`[UploadService] Old asset delete failed for ${options.oldPublicId}:`, err.message);
    });
  }

  // Attempt upload with exponential backoff
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = attempt === 1 ? 4000 : 12000; // 4s, 12s
      console.log(`[UploadService] Retry attempt ${attempt + 1} in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }

      const uploadOptions = {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite,
        secure: true,
      };
      if (resourceType === 'image') {
        uploadOptions.quality = 'auto';
        uploadOptions.fetch_format = 'auto';
      }

      const result = await _streamUpload(dataUrl, uploadOptions);

      return {
        secureUrl:    result.secure_url,
        publicId:     result.public_id,
        resourceType: result.resource_type,
        width:        result.width    || null,
        height:       result.height   || null,
        bytes:        result.bytes    || null,
        format:       result.format   || null,
        duration:     result.duration || null,
        createdAt:    result.created_at || new Date().toISOString(),
        folder,
      };
    } catch (err) {
      lastErr = err;
      console.error(`[UploadService] Upload attempt ${attempt + 1} failed:`, err.message);
    }
  }

  // All attempts failed
  throw uploadError(
    'CLOUDINARY_UPLOAD_FAILED',
    `Cloudinary upload failed after 3 attempts: ${lastErr?.message || 'Unknown error'}`,
    lastErr?.http_code || null
  );
}

/**
 * Wraps cloudinary.uploader.upload_stream in a Promise.
 * upload_stream is preferred over upload() because it doesn't need to write a temp file.
 */
function _streamUpload(dataUrl, uploadOptions) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });

    // Convert base64 data URL to Buffer and write to stream
    try {
      const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      stream.end(buffer);
    } catch (convErr) {
      reject(uploadError('BASE64_DECODE_ERROR', 'Failed to decode base64 data URL.', convErr.message));
    }
  });
}

// ── Delete a Cloudinary asset ─────────────────────────────────────────────────
/**
 * @param {string} publicId
 * @param {string} resourceType  'image' | 'video' | 'raw'
 */
export async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!isCloudinaryConfigured) return { result: 'skipped', reason: 'not_configured' };
  if (!publicId) return { result: 'skipped', reason: 'no_public_id' };

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true, // purge from Cloudinary CDN cache
    });
    console.log(`[UploadService] Deleted Cloudinary asset: ${publicId} → ${result.result}`);
    return result;
  } catch (err) {
    console.error(`[UploadService] Delete failed for ${publicId}:`, err.message);
    throw uploadError('CLOUDINARY_DELETE_FAILED', err.message);
  }
}

// ── Export Cloudinary config status for diagnostics ──────────────────────────
export function getCloudinaryStatus() {
  return {
    configured: isCloudinaryConfigured,
    cloudName: process.env.CLOUDINARY_URL
      ? new URL(process.env.CLOUDINARY_URL.replace('cloudinary://', 'https://')).hostname
      : process.env.CLOUDINARY_CLOUD_NAME || null,
  };
}
