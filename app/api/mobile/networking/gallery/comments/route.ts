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

const DEFAULT_LIMIT = 40;

function clampLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(10, Math.min(120, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const attendee = resolved.session.attendee;
  if (!attendee?.id) {
    return NextResponse.json({ error: "Galeri için onboarding tamamlanmalı." }, { status: 400 });
  }

  const itemId = request.nextUrl.searchParams.get("itemId")?.trim() ?? "";
  const limit = clampLimit(request.nextUrl.searchParams.get("limit"));

  if (!isValidUuid(itemId)) {
    return NextResponse.json({ error: "Geçersiz galeri kimliği." }, { status: 400 });
  }

  const [commentsResult, countResult] = await Promise.all([
    resolved.session.supabase
      .from("networking_gallery_comments")
      .select("id, gallery_item_id, attendee_id, text, created_at")
      .eq("gallery_item_id", itemId)
      .order("created_at", { ascending: true })
      .limit(limit),
    resolved.session.supabase
      .from("networking_gallery_comments")
      .select("id", { count: "exact", head: true })
      .eq("gallery_item_id", itemId)
  ]);

  if (commentsResult.error) {
    return NextResponse.json(
      { error: `Yorumlar alınamadı: ${commentsResult.error.message}` },
      { status: 500 }
    );
  }

  if (countResult.error) {
    return NextResponse.json(
      { error: `Yorum sayısı alınamadı: ${countResult.error.message}` },
      { status: 500 }
    );
  }

  const comments = commentsResult.data ?? [];
  const commentAttendeeIds = Array.from(
    new Set(comments.map((comment) => comment.attendee_id).filter(Boolean))
  );

  let attendeeById = new Map<string, { name: string; role: string | null }>();
  if (commentAttendeeIds.length > 0) {
    const attendeesResult = await resolved.session.supabase
      .from("attendees")
      .select("id, name, role")
      .in("id", commentAttendeeIds);

    if (attendeesResult.error) {
      return NextResponse.json(
        { error: `Yorum yapan katılımcılar alınamadı: ${attendeesResult.error.message}` },
        { status: 500 }
      );
    }

    attendeeById = new Map(
      (attendeesResult.data ?? []).map((row) => [
        row.id,
        {
          name: row.name,
          role: row.role
        }
      ])
    );
  }

  const payloadComments: MobileNetworkingGalleryComment[] = comments.map((comment) => {
    const commentAttendee = attendeeById.get(comment.attendee_id);
    return {
      id: comment.id,
      itemId: comment.gallery_item_id,
      attendeeId: comment.attendee_id,
      attendeeName: commentAttendee?.name ?? "Katılımcı",
      attendeeRole: commentAttendee?.role ?? null,
      text: comment.text,
      createdAt: comment.created_at
    };
  });

  return NextResponse.json({
    ok: true,
    itemId,
    comments: payloadComments,
    total: countResult.count ?? payloadComments.length
  });
}

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
    if (insertResult.error.code === "23503") {
      return NextResponse.json({ error: "Galeri kaydı bulunamadı." }, { status: 404 });
    }
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
