import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  GALLERY_BUCKET_NAME,
  MAX_GALLERY_UPLOAD_BYTES,
  buildGalleryStoragePath,
  getErrorMessage,
  resolveGalleryMediaType,
  sanitizeCaption,
  sanitizeUploaderName
} from "@/lib/gallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadSessionPayload = {
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  uploaderName?: string;
  caption?: string;
};

export async function POST(request: NextRequest) {
  let payload: UploadSessionPayload = {};

  try {
    payload = (await request.json()) as UploadSessionPayload;
  } catch {
    payload = {};
  }

  const fileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "";
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.trim().toLowerCase() : "";
  const fileSize = Number(payload.fileSize);
  const uploaderName = sanitizeUploaderName(payload.uploaderName);
  const caption = sanitizeCaption(payload.caption);
  const mediaType = resolveGalleryMediaType(mimeType);

  if (!fileName || fileName.length > 180) {
    return NextResponse.json({ error: "Geçerli bir dosya adı gerekli." }, { status: 400 });
  }

  if (!mediaType) {
    return NextResponse.json(
      { error: "Sadece fotoğraf veya video dosyaları yüklenebilir." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_GALLERY_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Dosya boyutu en fazla ${Math.round(MAX_GALLERY_UPLOAD_BYTES / (1024 * 1024))} MB olabilir.` },
      { status: 400 }
    );
  }

  if (uploaderName.length < 2) {
    return NextResponse.json({ error: "Ad soyad en az 2 karakter olmalıdır." }, { status: 400 });
  }

  if (caption.length > 280) {
    return NextResponse.json({ error: "Açıklama en fazla 280 karakter olabilir." }, { status: 400 });
  }

  try {
    const objectPath = buildGalleryStoragePath(fileName, mediaType);
    const supabase = createSupabaseAdminClient();
    const data = await createSignedUploadSession(supabase, objectPath);

    return NextResponse.json({
      ok: true,
      upload: {
        path: data.path,
        token: data.token,
        signedUrl: data.signedUrl
      },
      normalized: {
        mediaType,
        mimeType,
        fileSize,
        uploaderName,
        caption
      }
    });
  } catch (error) {
    const diagnosed = diagnoseUploadSessionError(error);
    return NextResponse.json(
      {
        error: diagnosed.message,
        code: diagnosed.code
      },
      { status: 500 }
    );
  }
}

async function createSignedUploadSession(supabase: SupabaseClient, objectPath: string) {
  const firstAttempt = await supabase.storage.from(GALLERY_BUCKET_NAME).createSignedUploadUrl(objectPath);
  if (!firstAttempt.error && firstAttempt.data) {
    return firstAttempt.data;
  }

  const firstErrorMessage = firstAttempt.error?.message ?? "";
  if (!shouldCreateBucketFromError(firstErrorMessage)) {
    throw new Error(firstErrorMessage || "Yükleme oturumu oluşturulamadı.");
  }

  const { error: createError } = await supabase.storage.createBucket(GALLERY_BUCKET_NAME, {
    public: true,
    fileSizeLimit: MAX_GALLERY_UPLOAD_BYTES
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(`Galeri bucket oluşturulamadı: ${createError.message}`);
  }

  const secondAttempt = await supabase.storage.from(GALLERY_BUCKET_NAME).createSignedUploadUrl(objectPath);
  if (secondAttempt.error || !secondAttempt.data) {
    throw new Error(secondAttempt.error?.message ?? "Yükleme oturumu oluşturulamadı.");
  }

  return secondAttempt.data;
}

function shouldCreateBucketFromError(message: string) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("bucket") &&
    (normalized.includes("not found") ||
      normalized.includes("does not exist") ||
      normalized.includes("not exist"))
  );
}

function diagnoseUploadSessionError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message.trim() : "";
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes("missing supabase_url") ||
    normalized.includes("supabase_service_role_key")
  ) {
    return {
      code: "MISSING_SUPABASE_SERVER_ENV",
      message:
        "Sunucu ayarı eksik: Vercel'de SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı."
    };
  }

  if (
    normalized.includes("invalid api key") ||
    normalized.includes("jwt") ||
    normalized.includes("not authorized") ||
    normalized.includes("row-level security") ||
    normalized.includes("permission denied")
  ) {
    return {
      code: "INVALID_SUPABASE_SERVICE_ROLE_KEY",
      message:
        "Supabase servis anahtarı geçersiz veya yetkisiz. SUPABASE_SERVICE_ROLE_KEY değerini kontrol edin (anon key değil service_role olmalı)."
    };
  }

  if (shouldCreateBucketFromError(rawMessage)) {
    return {
      code: "STORAGE_BUCKET_MISSING",
      message:
        "event-gallery bucket bulunamadı. Supabase Storage'da bucket'ı oluşturup tekrar deneyin."
    };
  }

  if (normalized.includes("bucket")) {
    return {
      code: "STORAGE_BUCKET_ERROR",
      message:
        "Supabase Storage bucket erişimi başarısız. Storage servisinin açık olduğundan ve anahtarın yetkili olduğundan emin olun."
    };
  }

  if (process.env.NODE_ENV !== "production" && rawMessage) {
    return {
      code: "UPLOAD_SESSION_ERROR",
      message: rawMessage
    };
  }

  return {
    code: "UPLOAD_SESSION_ERROR",
    message: getErrorMessage(error, "Yükleme oturumu oluşturulamadı.")
  };
}
