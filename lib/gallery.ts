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
