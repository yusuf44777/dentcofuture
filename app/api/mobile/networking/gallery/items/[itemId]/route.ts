import { NextRequest, NextResponse } from "next/server";
import { deleteFileFromGoogleDrive } from "@/lib/google-drive-backup";
import { GALLERY_BUCKET_NAME } from "@/lib/gallery";
import { resolveMobileSession } from "@/lib/mobile/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

type GalleryItemRow = {
  id: string;
  uploader_name: string;
  file_path: string;
  drive_file_id: string | null;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
}

function resolveBatchIdFromPath(filePath: string) {
  const fileName = filePath.split("/").pop() ?? "";
  const fileStem = fileName.replace(/\.[^.]+$/, "");
  const batchMatch = fileStem.match(/^([a-z0-9]{8,28})__/i);
  return batchMatch?.[1]?.toLowerCase() ?? null;
}

function isStorageObjectMissing(message: string) {
  const normalized = message.trim().toLowerCase();
  return normalized.includes("not found") || normalized.includes("does not exist");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const attendee = resolved.session.attendee;
  if (!attendee?.id) {
    return NextResponse.json({ error: "Paylaşım silmek için onboarding tamamlanmalı." }, { status: 400 });
  }

  const { itemId } = await context.params;
  if (!isValidUuid(itemId)) {
    return NextResponse.json({ error: "Geçersiz medya kimliği." }, { status: 400 });
  }

  const supabase = resolved.session.supabase;
  const { data: targetItem, error: targetError } = await supabase
    .from("event_gallery_items")
    .select("id, uploader_name, file_path, drive_file_id")
    .eq("id", itemId)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: `Paylaşım bulunamadı: ${targetError.message}` }, { status: 500 });
  }

  if (!targetItem) {
    return NextResponse.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
  }

  const meName = normalizeName(attendee.name);
  const uploaderName = normalizeName(targetItem.uploader_name);
  if (!meName || meName !== uploaderName) {
    return NextResponse.json({ error: "Sadece kendi paylaşımını silebilirsin." }, { status: 403 });
  }

  const batchId = resolveBatchIdFromPath(targetItem.file_path);
  let ownedItems: GalleryItemRow[] = [targetItem as GalleryItemRow];

  if (batchId) {
    const { data: batchItems, error: batchError } = await supabase
      .from("event_gallery_items")
      .select("id, uploader_name, file_path, drive_file_id")
      .ilike("file_path", `%/${batchId}__%`);

    if (batchError) {
      return NextResponse.json(
        { error: `Karosel paylaşımı okunamadı: ${batchError.message}` },
        { status: 500 }
      );
    }

    const filtered = ((batchItems ?? []) as GalleryItemRow[]).filter(
      (item) => normalizeName(item.uploader_name) === meName
    );

    if (filtered.length > 0) {
      ownedItems = filtered;
    }
  }

  const pathsToDelete = ownedItems.map((item) => item.file_path);
  const idsToDelete = ownedItems.map((item) => item.id);

  if (pathsToDelete.length > 0) {
    const { error: removeStorageError } = await supabase.storage
      .from(GALLERY_BUCKET_NAME)
      .remove(pathsToDelete);
    if (removeStorageError && !isStorageObjectMissing(removeStorageError.message)) {
      return NextResponse.json(
        { error: `Medya dosyaları silinemedi: ${removeStorageError.message}` },
        { status: 500 }
      );
    }
  }

  for (const item of ownedItems) {
    if (typeof item.drive_file_id === "string" && item.drive_file_id.trim().length > 0) {
      const driveDeleteResult = await deleteFileFromGoogleDrive(item.drive_file_id);
      if (driveDeleteResult.status === "failed") {
        console.warn("Google Drive dosyası silinemedi", {
          itemId: item.id,
          driveFileId: item.drive_file_id,
          error: driveDeleteResult.error
        });
      }
    }
  }

  const { error: deleteError } = await supabase.from("event_gallery_items").delete().in("id", idsToDelete);
  if (deleteError) {
    return NextResponse.json({ error: `Paylaşım silinemedi: ${deleteError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deletedCount: idsToDelete.length,
    deletedItemIds: idsToDelete
  });
}
