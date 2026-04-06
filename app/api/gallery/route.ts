import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  clampGalleryLimit,
  getErrorMessage,
  type GalleryMediaType
} from "@/lib/gallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GalleryRow = {
  id: string;
  uploader_name: string;
  caption: string | null;
  media_type: GalleryMediaType;
  mime_type: string;
  file_path: string;
  public_url: string;
  file_size: number;
  drive_backup_status: string;
  drive_file_id: string | null;
  drive_error: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = clampGalleryLimit(searchParams.get("limit"));
  const mediaType = searchParams.get("type")?.trim().toLowerCase() ?? "";

  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("event_gallery_items")
      .select(
        "id, uploader_name, caption, media_type, mime_type, file_path, public_url, file_size, drive_backup_status, drive_file_id, drive_error, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (mediaType === "photo" || mediaType === "video") {
      query = query.eq("media_type", mediaType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Galeri listesi alınamadı: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      items: (data ?? []) as GalleryRow[]
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Galeri listesi alınamadı.")
      },
      { status: 500 }
    );
  }
}
