import { randomUUID } from "node:crypto";

export const GALLERY_BUCKET_NAME = "event-gallery";
export const MAX_GALLERY_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_GALLERY_CAPTION_LENGTH = 280;
export const MAX_GALLERY_UPLOADER_LENGTH = 120;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif"
]);

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/3gpp"
]);

export type GalleryMediaType = "photo" | "video";
export type GalleryBackupStatus = "pending" | "synced" | "failed" | "disabled";
export type GalleryStorageMode = "supabase" | "drive";

export function resolveGalleryStorageMode(): GalleryStorageMode {
  const rawValue = process.env.GALLERY_STORAGE_MODE?.trim().toLowerCase() ?? "";

  if (["drive", "drive-only", "drive_only", "google-drive", "google_drive"].includes(rawValue)) {
    return "drive";
  }

  return "supabase";
}

export function shouldRemoveSupabaseCopyAfterDriveSync() {
  if (resolveGalleryStorageMode() === "drive") {
    return true;
  }

  return readBooleanEnv("GALLERY_REMOVE_SUPABASE_COPY_AFTER_DRIVE_SYNC", false);
}

export function shouldRequireDriveSync() {
  if (resolveGalleryStorageMode() === "drive") {
    return true;
  }

  return readBooleanEnv("GALLERY_REQUIRE_DRIVE_SYNC", false);
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (process.env.NODE_ENV === "production") {
    return fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export function sanitizeUploaderName(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, MAX_GALLERY_UPLOADER_LENGTH);
}

export function sanitizeCaption(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, MAX_GALLERY_CAPTION_LENGTH);
}

export function clampGalleryLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 48;
  }

  return Math.max(1, Math.min(120, Math.floor(parsed)));
}

export function resolveGalleryMediaType(mimeType: unknown): GalleryMediaType | null {
  if (typeof mimeType !== "string") {
    return null;
  }

  const normalized = mimeType.trim().toLowerCase();
  if (IMAGE_MIME_TYPES.has(normalized)) {
    return "photo";
  }
  if (VIDEO_MIME_TYPES.has(normalized)) {
    return "video";
  }

  return null;
}

export function isValidGalleryObjectPath(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  return /^gallery\/(photo|video)\/[0-9]{4}\/[0-9]{2}\/[a-z0-9_-]+\.[a-z0-9]{2,10}$/i.test(
    value.trim()
  );
}

export function buildGalleryStoragePath(fileName: string, mediaType: GalleryMediaType) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const extension = inferFileExtension(fileName);
  const safeExtension = extension || (mediaType === "video" ? "mp4" : "jpg");
  const randomPart = randomUUID().replace(/-/g, "").slice(0, 20);

  return `gallery/${mediaType}/${year}/${month}/${randomPart}.${safeExtension}`;
}

const GOOGLE_DRIVE_FILE_ID_PATTERNS = [
  /[?&]id=([a-zA-Z0-9_-]{10,})/i,
  /\/d\/([a-zA-Z0-9_-]{10,})(?:[/?#]|$)/i,
  /^([a-zA-Z0-9_-]{10,})$/i
];

export function extractGoogleDriveFileId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  for (const pattern of GOOGLE_DRIVE_FILE_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    const fileId = match?.[1]?.trim();
    if (fileId) {
      return fileId;
    }
  }

  return null;
}

function isGoogleDriveUrl(value: string) {
  return /^https?:\/\/(?:[^/]+\.)?(?:drive\.google\.com|docs\.google\.com|googleusercontent\.com|lh3\.googleusercontent\.com)\//i.test(
    value.trim()
  );
}

function buildGoogleDrivePhotoUrl(fileId: string) {
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w2048`;
}

function buildGoogleDriveVideoUrl(fileId: string) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

export function normalizeGalleryPublicUrl(input: {
  publicUrl: string;
  mediaType: GalleryMediaType;
  driveFileId?: string | null;
}) {
  const publicUrl = input.publicUrl.trim();
  const knownDriveId =
    (typeof input.driveFileId === "string" ? input.driveFileId.trim() : "") ||
    extractGoogleDriveFileId(publicUrl) ||
    "";

  if (!publicUrl && !knownDriveId) {
    return publicUrl;
  }

  if (!isGoogleDriveUrl(publicUrl) && publicUrl) {
    return publicUrl;
  }

  if (!knownDriveId) {
    return publicUrl;
  }

  if (input.mediaType === "photo") {
    return buildGoogleDrivePhotoUrl(knownDriveId);
  }

  return buildGoogleDriveVideoUrl(knownDriveId);
}

function inferFileExtension(fileName: string) {
  const cleaned = fileName.trim().toLowerCase();
  const parts = cleaned.split(".");
  if (parts.length < 2) {
    return "";
  }

  const rawExtension = parts[parts.length - 1] ?? "";
  const normalized = rawExtension.replace(/[^a-z0-9]/g, "");
  if (normalized.length < 2 || normalized.length > 10) {
    return "";
  }

  return normalized;
}

function readBooleanEnv(name: string, defaultValue: boolean) {
  const rawValue = process.env[name];
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return defaultValue;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}
