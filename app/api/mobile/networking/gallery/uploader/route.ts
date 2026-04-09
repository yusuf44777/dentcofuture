import { NextRequest, NextResponse } from "next/server";
import type { MobileNetworkingGalleryUploaderProfile } from "@/lib/mobile/contracts";
import { normalizeGalleryPublicUrl } from "@/lib/gallery";
import { resolveMobileSession } from "@/lib/mobile/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GalleryItemRow = {
  id: string;
  uploader_name: string;
  caption: string | null;
  media_type: "photo" | "video";
  public_url: string;
  created_at: string;
};

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function clampLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 24;
  }

  return Math.max(6, Math.min(60, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  if (!resolved.session.attendee?.id) {
    return NextResponse.json({ error: "Profil için onboarding tamamlanmalı." }, { status: 400 });
  }

  const uploaderName = normalizeName(request.nextUrl.searchParams.get("name") ?? "");
  const limit = clampLimit(request.nextUrl.searchParams.get("limit"));

  if (uploaderName.length < 2) {
    return NextResponse.json({ error: "Geçerli bir kullanıcı adı gerekli." }, { status: 400 });
  }

  const [attendeesResult, itemsResult] = await Promise.all([
    resolved.session.supabase
      .from("attendees")
      .select("id, name, role, class_level, instagram, linkedin, created_at")
      .eq("name", uploaderName)
      .order("created_at", { ascending: true })
      .limit(1),
    resolved.session.supabase
      .from("event_gallery_items")
      .select("id, uploader_name, caption, media_type, public_url, created_at")
      .eq("uploader_name", uploaderName)
      .order("created_at", { ascending: false })
      .limit(limit)
  ]);

  if (attendeesResult.error) {
    return NextResponse.json(
      { error: `Paylaşım sahibi bilgisi alınamadı: ${attendeesResult.error.message}` },
      { status: 500 }
    );
  }

  if (itemsResult.error) {
    return NextResponse.json(
      { error: `Paylaşım listesi alınamadı: ${itemsResult.error.message}` },
      { status: 500 }
    );
  }

  const attendee = attendeesResult.data?.[0] ?? null;
  const items = (itemsResult.data ?? []) as GalleryItemRow[];
  const itemIds = items.map((item) => item.id);

  let likesByItem = new Map<string, number>();
  let commentsByItem = new Map<string, number>();

  if (itemIds.length > 0) {
    const [likesResult, commentsResult] = await Promise.all([
      resolved.session.supabase
        .from("networking_gallery_likes")
        .select("gallery_item_id")
        .in("gallery_item_id", itemIds),
      resolved.session.supabase
        .from("networking_gallery_comments")
        .select("gallery_item_id")
        .in("gallery_item_id", itemIds)
    ]);

    if (likesResult.error) {
      return NextResponse.json(
        { error: `Beğeni verisi alınamadı: ${likesResult.error.message}` },
        { status: 500 }
      );
    }
    if (commentsResult.error) {
      return NextResponse.json(
        { error: `Yorum verisi alınamadı: ${commentsResult.error.message}` },
        { status: 500 }
      );
    }

    likesByItem = countByGalleryItem(likesResult.data ?? []);
    commentsByItem = countByGalleryItem(commentsResult.data ?? []);
  }

  const payload: MobileNetworkingGalleryUploaderProfile = {
    ok: true,
    uploader: {
      attendeeId: attendee?.id ?? null,
      name: uploaderName,
      role: attendee?.role ?? null,
      classLevel: attendee?.class_level ?? null,
      instagram: attendee?.instagram ?? null,
      linkedin: attendee?.linkedin ?? null
    },
    posts: items.map((item) => ({
      id: item.id,
      caption: item.caption,
      mediaType: item.media_type,
      publicUrl: normalizeGalleryPublicUrl({
        publicUrl: item.public_url,
        mediaType: item.media_type
      }),
      createdAt: item.created_at,
      likesCount: likesByItem.get(item.id) ?? 0,
      commentsCount: commentsByItem.get(item.id) ?? 0
    })),
    refreshedAt: new Date().toISOString()
  };

  return NextResponse.json(payload);
}

function countByGalleryItem(rows: Array<{ gallery_item_id: string }>) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const current = counts.get(row.gallery_item_id) ?? 0;
    counts.set(row.gallery_item_id, current + 1);
  }

  return counts;
}
