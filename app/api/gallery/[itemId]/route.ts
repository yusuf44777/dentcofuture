import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { deleteFileFromGoogleDrive } from "@/lib/google-drive-backup";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GALLERY_BUCKET_NAME, getErrorMessage } from "@/lib/gallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isAuthorized(request: NextRequest) {
  const adminSecret =
    process.env.GALLERY_ADMIN_SECRET?.trim() || process.env.RAFFLE_ADMIN_SECRET?.trim() || "";

  return isModeratorRequestAuthorized(request, {
    secret: adminSecret,
    secretHeaderName: "x-gallery-secret"
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  const { itemId } = await context.params;
  if (!isValidUuid(itemId)) {
    return NextResponse.json({ error: "Geçersiz medya kimliği." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: item, error: itemError } = await supabase
      .from("event_gallery_items")
      .select("id, file_path, drive_file_id")
      .eq("id", itemId)
      .maybeSingle();

    if (itemError) {
      throw new Error(`Galeri kaydı alınamadı: ${itemError.message}`);
    }

    if (!item) {
      return NextResponse.json({ error: "Galeri kaydı bulunamadı." }, { status: 404 });
    }

    const { error: removeStorageError } = await supabase.storage
      .from(GALLERY_BUCKET_NAME)
      .remove([item.file_path]);
    if (removeStorageError && !removeStorageError.message.toLowerCase().includes("not found")) {
      throw new Error(`Medya dosyası silinemedi: ${removeStorageError.message}`);
    }

    if (typeof item.drive_file_id === "string" && item.drive_file_id.trim().length > 0) {
      const driveDeleteResult = await deleteFileFromGoogleDrive(item.drive_file_id);
      if (driveDeleteResult.status === "failed") {
        console.warn("Google Drive dosyası silinemedi", {
          itemId,
          driveFileId: item.drive_file_id,
          error: driveDeleteResult.error
        });
      }
    }

    const { error: deleteError } = await supabase.from("event_gallery_items").delete().eq("id", itemId);
    if (deleteError) {
      throw new Error(`Galeri kaydı silinemedi: ${deleteError.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Galeri kaydı silinemedi.")
      },
      { status: 500 }
    );
  }
}
