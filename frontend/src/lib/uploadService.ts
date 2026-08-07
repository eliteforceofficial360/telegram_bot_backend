/**
 * uploadService.ts — Elite Force Frontend Upload Service
 *
 * Single entry point for ALL media uploads in the admin panel.
 * Replaces the inline uploadImageToBot function in Admin.tsx.
 *
 * Upload Strategy (in priority order):
 *   Images → ImgBB (fast, no backend required)
 *   Videos ≤ 5MB base64 → stored as data URL (no backend)
 *   Images (ImgBB fail) + Videos > 5MB → Bot API / Cloudinary
 *   All fallback → data URL if ≤ 5MB
 *
 * Features:
 *   - Client-side MIME validation (magic bytes)
 *   - File size & type limits
 *   - Exponential backoff retry (3 attempts: 0s → 4s → 12s)
 *   - Upload progress callbacks
 *   - Deduplication: prevents concurrent uploads of the same key
 *   - Structured error responses { code, message }
 *   - Cloudinary metadata returned (secureUrl, publicId, resourceType, etc.)
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const IMGBB_API_KEY = '6d70077319714757c9a96e622b78edc3';
const FALLBACK_BOT_URL = (import.meta.env.VITE_BOT_API_URL || 'https://telegram-bot-backend-zbvn.onrender.com').trim();
const BOT_API_SECRET = (import.meta.env.VITE_BOT_API_SECRET || 'elite_force_secret_2024').trim();

/** Maximum base64 string length we'll store as a data URL in Firestore (≈ 10MB file) */
const MAX_DATA_URL_LENGTH = 14 * 1024 * 1024;

// Allowed MIME types and their max sizes
const ALLOWED_TYPES: Record<string, { maxBytes: number; label: string }> = {
  'image/jpeg':  { maxBytes: 15 * 1024 * 1024, label: 'JPEG image' },
  'image/png':   { maxBytes: 15 * 1024 * 1024, label: 'PNG image' },
  'image/webp':  { maxBytes: 15 * 1024 * 1024, label: 'WebP image' },
  'image/gif':   { maxBytes: 15 * 1024 * 1024, label: 'GIF image' },
  'image/svg+xml':{ maxBytes: 5  * 1024 * 1024, label: 'SVG image' },
  'video/mp4':   { maxBytes: 100 * 1024 * 1024, label: 'MP4 video' },
  'video/webm':  { maxBytes: 100 * 1024 * 1024, label: 'WebM video' },
  'video/quicktime': { maxBytes: 100 * 1024 * 1024, label: 'MOV video' },
  'video/ogg':   { maxBytes: 100 * 1024 * 1024, label: 'OGG video' },
};

// Magic byte signatures for client-side true MIME detection
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/gif',  bytes: [0x47, 0x49, 0x46] },
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // RIFF????WEBP
  { mime: 'video/mp4',  bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp box
];

// ── Type Definitions ──────────────────────────────────────────────────────────

export interface UploadResult {
  secureUrl: string;
  publicId?: string;
  resourceType?: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
  duration?: number | null;
  createdAt?: string;
  /** true if stored as data URL (no Cloudinary public_id) */
  isDataUrl?: boolean;
}

export interface UploadOptions {
  /** Asset key used for deduplication guard and folder routing */
  assetKey?: string;
  /** Bot API base URL (from admin settings) */
  botApiUrl?: string;
  /** Bot API secret (from admin settings) */
  botApiSecret?: string;
  /** Cloudinary folder type: 'banner' | 'icon' | 'profile' | 'video' | 'task' | 'branding' */
  folder?: string;
  /** Optional Cloudinary public_id to overwrite */
  publicId?: string;
  /** Public ID of old asset to delete before uploading */
  oldPublicId?: string;
  /** Upload progress callback: 0–100 */
  onProgress?: (pct: number) => void;
}

export interface UploadError {
  code: string;
  message: string;
}

// ── In-progress guard (prevents duplicate uploads per asset key) ──────────────
const _inProgress = new Set<string>();

// ── Entry Point ───────────────────────────────────────────────────────────────

/**
 * Upload a File object. Validates, converts to base64, then calls uploadFromDataUrl.
 */
export async function uploadFile(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  // ── 1. Validate MIME type ──────────────────────────────────────────────────
  const declared = file.type.toLowerCase();
  if (!ALLOWED_TYPES[declared]) {
    throw _error('INVALID_MIME_TYPE', `File type "${declared || 'unknown'}" is not allowed. Accepted: JPEG, PNG, WebP, GIF, SVG, MP4, WebM, MOV, OGG.`);
  }

  // ── 2. Magic-byte MIME verification ───────────────────────────────────────
  const trueMime = await _detectMimeFromBytes(file);
  if (trueMime && trueMime !== declared && !_isMimeCompatible(trueMime, declared)) {
    throw _error('MIME_SPOOFING_DETECTED', `File claims to be "${declared}" but content signature indicates "${trueMime}". Upload rejected.`);
  }

  // ── 3. Size validation ─────────────────────────────────────────────────────
  const typeConfig = ALLOWED_TYPES[declared];
  if (file.size > typeConfig.maxBytes) {
    const maxMB = (typeConfig.maxBytes / (1024 * 1024)).toFixed(0);
    throw _error('FILE_TOO_LARGE', `Maximum upload size for ${typeConfig.label} is ${maxMB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
  }

  options.onProgress?.(5);

  // ── 4. Convert to base64 data URL ─────────────────────────────────────────
  const dataUrl = await _fileToDataUrl(file);
  options.onProgress?.(15);

  // ── 5. Delegate to data URL uploader ──────────────────────────────────────
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const filename = `${options.assetKey || 'upload'}_${Date.now()}.${ext}`;

  return uploadFromDataUrl(dataUrl, filename, options);
}

/**
 * Upload a base64 data URL string directly (used when file has already been read).
 * All Admin.tsx uploads should call this function.
 */
export async function uploadFromDataUrl(
  dataUrl: string,
  filename: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const key = options.assetKey || filename;

  // ── Deduplication guard ──────────────────────────────────────────────────
  if (_inProgress.has(key)) {
    throw _error('UPLOAD_IN_PROGRESS', 'An upload for this asset is already in progress. Please wait.');
  }
  _inProgress.add(key);

  try {
    return await _doUpload(dataUrl, filename, options);
  } finally {
    _inProgress.delete(key);
  }
}

/**
 * Delete a Cloudinary asset via the bot API.
 */
export async function deleteCloudinaryAsset(
  publicId: string,
  resourceType = 'image',
  options: Pick<UploadOptions, 'botApiUrl' | 'botApiSecret'> = {}
): Promise<void> {
  const base = (options.botApiUrl || FALLBACK_BOT_URL).replace(/\/$/, '');
  const secret = options.botApiSecret || BOT_API_SECRET;

  const res = await fetch(`${base}/upload-delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify({ publicId, resourceType }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw _error(body.code || 'DELETE_FAILED', body.message || `Delete failed (HTTP ${res.status})`);
  }
}

// ── Internal upload orchestrator ──────────────────────────────────────────────

async function _doUpload(
  dataUrl: string,
  filename: string,
  options: UploadOptions
): Promise<UploadResult> {
  const isVideo = dataUrl.startsWith('data:video/');
  const onProgress = options.onProgress || (() => {});

  onProgress(20);

  // ── Path A: Images → ImgBB (fast, no backend needed) ──────────────────────
  if (!isVideo) {
    try {
      const imgbbUrl = await _uploadToImgbb(dataUrl);
      if (imgbbUrl) {
        onProgress(100);
        return { secureUrl: imgbbUrl, resourceType: 'image', isDataUrl: false };
      }
    } catch (e) {
      console.warn('[UploadService] ImgBB failed, trying backend:', e);
    }
    onProgress(40);
  }

  // ── Path B: Videos ≤ 5MB → store as data URL (no server needed) ───────────
  if (isVideo && dataUrl.length <= MAX_DATA_URL_LENGTH) {
    onProgress(100);
    return {
      secureUrl: dataUrl,
      resourceType: 'video',
      bytes: Math.round(dataUrl.length * 0.75), // approximate actual bytes
      isDataUrl: true,
    };
  }

  onProgress(50);

  // ── Path C: Bot API / Cloudinary (images fallback + large videos) ──────────
  const base = (options.botApiUrl || FALLBACK_BOT_URL).replace(/\/$/, '');
  const secret = options.botApiSecret || BOT_API_SECRET;
  const folder = _folderForType(isVideo ? 'video' : (options.folder || 'branding'));

  // Wake up Render.com free-tier server (fire-and-forget ping, 15s patience)
  _pingServer(base, 15000);

  onProgress(60);

  // Retry with exponential backoff
  let lastErr: UploadError | null = null;
  const delays = [0, 5000, 15000];

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      console.log(`[UploadService] Retry in ${delays[attempt] / 1000}s (attempt ${attempt + 1})...`);
      await _sleep(delays[attempt]);
    }

    try {
      const res = await _botApiUpload(base, secret, dataUrl, filename, folder, options, isVideo);
      if (res.secureUrl) {
        onProgress(100);
        return res;
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`[UploadService] Bot API attempt ${attempt + 1} failed:`, err.message || err);
    }
    onProgress(60 + attempt * 10);
  }

  onProgress(90);

  // ── Path D: Final fallback → data URL (if small enough) ───────────────────
  if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
    onProgress(100);
    return {
      secureUrl: dataUrl,
      resourceType: isVideo ? 'video' : 'image',
      bytes: Math.round(dataUrl.length * 0.75),
      isDataUrl: true,
    };
  }

  // All paths exhausted
  throw _error(
    isVideo ? 'VIDEO_TOO_LARGE' : 'IMAGE_UPLOAD_FAILED',
    isVideo
      ? `Video upload failed and the file is too large (${(dataUrl.length / (1024 * 1024)).toFixed(1)}MB) to store locally. Please paste a hosted video URL (Cloudinary, YouTube, etc.) or use a smaller video under 10MB. Server: ${lastErr?.message || 'unreachable'}.`
      : `Image upload failed. ${lastErr?.message || 'Please try again or use a smaller image.'}`
  );
}

// ── ImgBB upload ──────────────────────────────────────────────────────────────

async function _uploadToImgbb(dataUrl: string): Promise<string | null> {
  const cleanBase64 = dataUrl.replace(/^data:image\/[\w+.-]+;base64,/, '');
  const formData = new FormData();
  formData.append('key', IMGBB_API_KEY);
  formData.append('image', cleanBase64);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const d = await res.json();
    return d.data?.url || d.data?.display_url || null;
  } catch {
    clearTimeout(t);
    return null;
  }
}

// ── Bot API upload ─────────────────────────────────────────────────────────────

async function _botApiUpload(
  baseUrl: string,
  secret: string,
  dataUrl: string,
  filename: string,
  folder: string,
  options: UploadOptions,
  isVideo: boolean
): Promise<UploadResult> {
  const ctrl = new AbortController();
  // Videos need more time: Render cold start (30s) + Cloudinary upload
  const timeoutMs = isVideo ? 120_000 : 45_000;
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/upload-branding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify({
        image: dataUrl,
        filename,
        folder,
        publicId: options.publicId,
        oldPublicId: options.oldPublicId,
        oldResourceType: isVideo ? 'video' : 'image',
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }

  if (!res!.ok) {
    const body = await res!.json().catch(() => ({}));
    throw _error(
      body.code || 'BOT_API_ERROR',
      body.message || `Upload API returned HTTP ${res!.status}.`
    );
  }

  const data = await res!.json();
  if (!data.secureUrl) {
    throw _error('MISSING_URL', 'Upload API returned OK but no secureUrl in response.');
  }

  return {
    secureUrl:    data.secureUrl,
    publicId:     data.publicId     || undefined,
    resourceType: data.resourceType || (isVideo ? 'video' : 'image'),
    width:        data.width        || null,
    height:       data.height       || null,
    bytes:        data.bytes        || null,
    format:       data.format       || null,
    duration:     data.duration     || null,
    createdAt:    data.createdAt    || new Date().toISOString(),
    isDataUrl:    data.secureUrl.startsWith('data:'),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _error(code: string, message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

function _sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function _pingServer(baseUrl: string, timeoutMs: number): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    await fetch(`${baseUrl}/health`, { signal: ctrl.signal });
    clearTimeout(t);
  } catch {
    /* silent — server may be waking up */
  }
}

async function _fileToDataUrl(file: File): Promise<string> {
  if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
    try {
      const compressed = await _compressImageFile(file, 1200, 0.82);
      if (compressed) return compressed;
    } catch (e) {
      console.warn('[UploadService] Image compression fallback to raw file:', e);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(_error('FILE_READ_ERROR', 'Failed to read file. Please try again.'));
    reader.readAsDataURL(file);
  });
}

function _compressImageFile(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        reject(new Error('Canvas context unavailable'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image decode failed'));
    };
    img.src = url;
  });
}

async function _detectMimeFromBytes(file: File): Promise<string | null> {
  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    for (const sig of MAGIC_BYTES) {
      const offset = sig.offset || 0;
      const match = sig.bytes.every((b, i) => bytes[offset + i] === b);
      if (match) return sig.mime;
    }
  } catch {
    // Detection failed — non-fatal
  }
  return null;
}

function _isMimeCompatible(detected: string, declared: string): boolean {
  // Allow JPEG/JPG interchange
  if (detected === 'image/jpeg' && declared === 'image/jpeg') return true;
  // Allow MP4 declared as video/mp4 even if ftyp box varies
  if (detected === 'video/mp4' && declared.startsWith('video/')) return true;
  return detected === declared;
}

function _folderForType(type: string): string {
  const map: Record<string, string> = {
    banner:   'uploads/banners',
    icon:     'uploads/icons',
    video:    'uploads/videos',
    task:     'uploads/tasks',
    profile:  'uploads/profile',
    branding: 'uploads/admin',
  };
  return map[type] || 'uploads/admin';
}
