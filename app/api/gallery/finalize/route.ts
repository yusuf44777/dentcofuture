import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { backupBytesToGoogleDrive } from "@/lib/google-drive-backup";
import {
  GALLERY_BUCKET_NAME,
  MAX_GALLERY_UPLOAD_BYTES,
  getErrorMessage,
  isValidGalleryObjectPath,
  normalizeGalleryPublicUrl,
  resolveGalleryStorageMode,
  resolveGalleryMediaType,
  sanitizeCaption,
  sanitizeUploaderName,
  shouldRemoveSupabaseCopyAfterDriveSync,
  shouldRequireDriveSync,
  type GalleryBackupStatus
} from "@/lib/gallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FinalizePayload = {
  path?: string;
  mimeType?: string;
  fileSize?: number;
  uploaderName?: string;
  caption?: string;
};

type GalleryItem = {
  id: string;
  uploader_name: string;
  caption: string | null;
  media_type: "photo" | "video";
  mime_type: string;
  file_path: string;
  public_url: string;
  file_size: number;
  drive_backup_status: GalleryBackupStatus;
  drive_file_id: string | null;
  drive_error: string | null;
  created_at: string;
};

function isStorageObjectMissing(message: string) {
  const normalized = message.trim().toLowerCase();
  return normalized.includes("not found") || normalized.includes("does not exist");
}

export async function POST(request: NextRequest) {
  let payload: FinalizePayload = {};

  try {
    payload = (await request.json()) as FinalizePayload;
  } catch {
    payload = {};
  }

  const path = typeof payload.path === "string" ? payload.path.trim() : "";
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.trim().toLowerCase() : "";
  const fileSize = Number(payload.fileSize);
  const uploaderName = sanitizeUploaderName(payload.uploaderName);
  const caption = sanitizeCaption(payload.caption);
  const mediaType = resolveGalleryMediaType(mimeType);

  if (!isValidGalleryObjectPath(path)) {
    return NextResponse.json({ error: "Geçersiz medya yolu." }, { status: 400 });
  }

  if (!mediaType) {
    return NextResponse.json(
      { error: "Sadece fotoğraf veya video dosyaları desteklenir." },
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

  try {
    const supabase = createSupabaseAdminClient();
    const cleanupUploadedObject = async () => {
      const { error: removeError } = await supabase.storage.from(GALLERY_BUCKET_NAME).remove([path]);
      if (removeError && !isStorageObjectMissing(removeError.message)) {
        console.warn("Gecici galeri dosyasi temizlenemedi", {
          path,
          error: removeError.message
        });
      }
    };

    const { data: objectData, error: downloadError } = await supabase.storage
      .from(GALLERY_BUCKET_NAME)
      .download(path);

    if (downloadError || !objectData) {
      return NextResponse.json(
        {
          error: "Dosya bulunamadı. Lütfen yüklemeyi tekrar deneyin."
        },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await objectData.arrayBuffer());
    if (bytes.length === 0) {
      return NextResponse.json({ error: "Boş dosya işlenemiyor." }, { status: 400 });
    }

    const fileName = path.split("/").pop() || `media-${Date.now()}`;
    const driveBackup = await backupBytesToGoogleDrive({
      bytes,
      fileName,
      mimeType
    });

    const driveStatus: GalleryBackupStatus = driveBackup.status;
    const driveFileId = driveBackup.status === "synced" ? driveBackup.fileId : null;
    const driveError = driveBackup.status === "synced" ? null : driveBackup.error;
    const storageMode = resolveGalleryStorageMode();
    const requireDriveSync = shouldRequireDriveSync();
    const removeSupabaseCopy = shouldRemoveSupabaseCopyAfterDriveSync();
    const driveIsSynced = driveBackup.status === "synced";
    const drivePublicUrl = driveIsSynced ? driveBackup.publicUrl : null;

    if (requireDriveSync && !driveIsSynced) {
      await cleanupUploadedObject();
      return NextResponse.json(
        {
          error:
            driveBackup.error ||
            "Drive senkronu zorunlu ama dosya Google Drive'a aktarilamadi. Ayarlari kontrol edin."
        },
        { status: 500 }
      );
    }

    if (removeSupabaseCopy && driveIsSynced && !drivePublicUrl) {
      await cleanupUploadedObject();
      return NextResponse.json(
        {
          error:
            "Drive depolama aktif ama public URL uretilemedi. GOOGLE_DRIVE_MAKE_PUBLIC=true ayarlayin."
        },
        { status: 500 }
      );
    }

    const supabasePublicUrl = supabase.storage.from(GALLERY_BUCKET_NAME).getPublicUrl(path).data.publicUrl;
    let publicUrl = drivePublicUrl ?? supabasePublicUrl;

    if (removeSupabaseCopy && driveIsSynced && drivePublicUrl) {
      const { error: removeStorageError } = await supabase.storage.from(GALLERY_BUCKET_NAME).remove([path]);
      if (removeStorageError && !isStorageObjectMissing(removeStorageError.message)) {
        throw new Error(`Supabase gecici dosyasi silinemedi: ${removeStorageError.message}`);
      }
      publicUrl = drivePublicUrl;
    } else if (storageMode === "drive" && drivePublicUrl) {
      publicUrl = drivePublicUrl;
    }

    const normalizedPublicUrl = normalizeGalleryPublicUrl({
      publicUrl,
      mediaType,
      driveFileId
    });

    const { data: item, error: upsertError } = await supabase
      .from("event_gallery_items")
      .upsert(
        {
          uploader_name: uploaderName,
          caption: caption || null,
          media_type: mediaType,
          mime_type: mimeType,
          file_path: path,
          public_url: normalizedPublicUrl,
          file_size: bytes.length,
          drive_backup_status: driveStatus,
          drive_file_id: driveFileId,
          drive_error: driveError
        },
        {
          onConflict: "file_path"
        }
      )
      .select(
        "id, uploader_name, caption, media_type, mime_type, file_path, public_url, file_size, drive_backup_status, drive_file_id, drive_error, created_at"
      )
      .single();

    if (upsertError || !item) {
      throw new Error(upsertError?.message ?? "Galeri kaydı oluşturulamadı.");
    }

    return NextResponse.json({
      ok: true,
      item: item as GalleryItem,
      backup: {
        status: driveBackup.status,
        message:
          driveBackup.status === "synced"
            ? removeSupabaseCopy && driveBackup.publicUrl
              ? "Google Drive yedeği tamamlandı. Supabase kopyası temizlendi."
              : "Google Drive yedeği tamamlandı."
            : driveBackup.error
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Galeri kaydı tamamlanamadı.")
      },
      { status: 500 }
    );
  }
}
