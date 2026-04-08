import { NextRequest, NextResponse } from "next/server";
import type { MobileNetworkingGalleryComment } from "@/lib/mobile/contracts";
import { resolveMobileSession } from "@/lib/mobile/auth";
import { isValidUuid, normalizeText, readJsonBody } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  itemId?: string;
  text?: string;
};

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const attendee = resolved.session.attendee;
  if (!attendee?.id) {
    return NextResponse.json({ error: "Galeri için onboarding tamamlanmalı." }, { status: 400 });
  }

  const body = await readJsonBody<Body>(request);
  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
  const text = normalizeText(body.text);

  if (!isValidUuid(itemId)) {
    return NextResponse.json({ error: "Geçersiz galeri kimliği." }, { status: 400 });
  }

  if (!text || text.length > 280) {
    return NextResponse.json({ error: "Yorum 1-280 karakter aralığında olmalı." }, { status: 400 });
  }

  const itemResult = await resolved.session.supabase
    .from("event_gallery_items")
    .select("id")
    .eq("id", itemId)
    .maybeSingle();

  if (itemResult.error) {
    return NextResponse.json(
      { error: `Galeri kaydı doğrulanamadı: ${itemResult.error.message}` },
      { status: 500 }
    );
  }

  if (!itemResult.data) {
    return NextResponse.json({ error: "Galeri kaydı bulunamadı." }, { status: 404 });
  }

  const insertResult = await resolved.session.supabase
    .from("networking_gallery_comments")
    .insert({
      gallery_item_id: itemId,
      attendee_id: attendee.id,
      text
    })
    .select("id, gallery_item_id, attendee_id, text, created_at")
    .single();

  if (insertResult.error) {
    return NextResponse.json(
      { error: `Yorum eklenemedi: ${insertResult.error.message}` },
      { status: 500 }
    );
  }

  const countResult = await resolved.session.supabase
    .from("networking_gallery_comments")
    .select("id", { count: "exact", head: true })
    .eq("gallery_item_id", itemId);

  if (countResult.error) {
    return NextResponse.json(
      { error: `Yorum sayısı alınamadı: ${countResult.error.message}` },
      { status: 500 }
    );
  }

  const comment: MobileNetworkingGalleryComment = {
    id: insertResult.data.id,
    itemId: insertResult.data.gallery_item_id,
    attendeeId: insertResult.data.attendee_id,
    attendeeName: attendee.name,
    attendeeRole: attendee.role,
    text: insertResult.data.text,
    createdAt: insertResult.data.created_at
  };

  return NextResponse.json({
    ok: true,
    itemId,
    comment,
    commentsCount: countResult.count ?? 0
  });
}
