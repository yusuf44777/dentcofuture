import { NextRequest, NextResponse } from "next/server";
import { resolveMobileSession } from "@/lib/mobile/auth";
import { isValidUuid, readJsonBody } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  itemId?: string;
};

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const attendeeId = resolved.session.attendee?.id;
  if (!attendeeId) {
    return NextResponse.json({ error: "Galeri için onboarding tamamlanmalı." }, { status: 400 });
  }

  const body = await readJsonBody<Body>(request);
  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
  if (!isValidUuid(itemId)) {
    return NextResponse.json({ error: "Geçersiz galeri kimliği." }, { status: 400 });
  }

  const removeResult = await resolved.session.supabase
    .from("networking_gallery_likes")
    .delete()
    .eq("gallery_item_id", itemId)
    .eq("attendee_id", attendeeId)
    .select("id");

  if (removeResult.error) {
    return NextResponse.json(
      { error: `Beğeni kaldırılamadı: ${removeResult.error.message}` },
      { status: 500 }
    );
  }

  let liked = false;
  if ((removeResult.data ?? []).length > 0) {
    liked = false;
  } else {
    const insertResult = await resolved.session.supabase
      .from("networking_gallery_likes")
      .insert({
        gallery_item_id: itemId,
        attendee_id: attendeeId
      });

    if (insertResult.error) {
      if (insertResult.error.code === "23503") {
        return NextResponse.json({ error: "Galeri kaydı bulunamadı." }, { status: 404 });
      }
      return NextResponse.json(
        { error: `Beğeni eklenemedi: ${insertResult.error.message}` },
        { status: 500 }
      );
    }
    liked = true;
  }

  const countResult = await resolved.session.supabase
    .from("networking_gallery_likes")
    .select("id", { count: "exact", head: true })
    .eq("gallery_item_id", itemId);

  if (countResult.error) {
    return NextResponse.json(
      { error: `Beğeni sayısı alınamadı: ${countResult.error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    itemId,
    liked,
    likesCount: countResult.count ?? 0
  });
}
