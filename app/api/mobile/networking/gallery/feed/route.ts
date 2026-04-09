import { NextRequest, NextResponse } from "next/server";
import type {
  MobileNetworkingGalleryComment,
  MobileNetworkingGalleryFeed
} from "@/lib/mobile/contracts";
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

type GalleryLikeRow = {
  gallery_item_id: string;
  attendee_id: string;
};

type GalleryCommentRow = {
  id: string;
  gallery_item_id: string;
  attendee_id: string;
  text: string;
  created_at: string;
};

const DEFAULT_LIMIT = 18;

function clampLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(6, Math.min(36, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const attendeeId = resolved.session.attendee?.id;
  if (!attendeeId) {
    return NextResponse.json({ error: "Galeri için onboarding tamamlanmalı." }, { status: 400 });
  }

  const limit = clampLimit(request.nextUrl.searchParams.get("limit"));

  const itemsResult = await resolved.session.supabase
    .from("event_gallery_items")
    .select("id, uploader_name, caption, media_type, public_url, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (itemsResult.error) {
    return NextResponse.json(
      { error: `Galeri akışı alınamadı: ${itemsResult.error.message}` },
      { status: 500 }
    );
  }

  const items = (itemsResult.data ?? []) as GalleryItemRow[];
  if (items.length === 0) {
    const payload: MobileNetworkingGalleryFeed = {
      ok: true,
      posts: [],
      refreshedAt: new Date().toISOString()
    };
    return NextResponse.json(payload);
  }

  const itemIds = items.map((item) => item.id);

  const [likesResult, commentsResult] = await Promise.all([
    resolved.session.supabase
      .from("networking_gallery_likes")
      .select("gallery_item_id, attendee_id")
      .in("gallery_item_id", itemIds),
    resolved.session.supabase
      .from("networking_gallery_comments")
      .select("id, gallery_item_id, attendee_id, text, created_at")
      .in("gallery_item_id", itemIds)
      .order("created_at", { ascending: false })
  ]);

  if (likesResult.error) {
    return NextResponse.json(
      { error: `Galeri beğenileri alınamadı: ${likesResult.error.message}` },
      { status: 500 }
    );
  }

  if (commentsResult.error) {
    return NextResponse.json(
      { error: `Galeri yorumları alınamadı: ${commentsResult.error.message}` },
      { status: 500 }
    );
  }

  const likes = (likesResult.data ?? []) as GalleryLikeRow[];
  const comments = (commentsResult.data ?? []) as GalleryCommentRow[];

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

  const likeSetByItemId = new Map<string, Set<string>>();
  for (const like of likes) {
    const nextSet = likeSetByItemId.get(like.gallery_item_id) ?? new Set<string>();
    nextSet.add(like.attendee_id);
    likeSetByItemId.set(like.gallery_item_id, nextSet);
  }

  const commentsByItemId = new Map<string, GalleryCommentRow[]>();
  for (const comment of comments) {
    const current = commentsByItemId.get(comment.gallery_item_id) ?? [];
    current.push(comment);
    commentsByItemId.set(comment.gallery_item_id, current);
  }

  const posts = items.map((item) => {
    const likedBy = likeSetByItemId.get(item.id) ?? new Set<string>();
    const itemComments = commentsByItemId.get(item.id) ?? [];
    const recentComments: MobileNetworkingGalleryComment[] = itemComments.slice(0, 3).map((comment) => {
      const attendee = attendeeById.get(comment.attendee_id);
      return {
        id: comment.id,
        itemId: comment.gallery_item_id,
        attendeeId: comment.attendee_id,
        attendeeName: attendee?.name ?? "Katılımcı",
        attendeeRole: attendee?.role ?? null,
        text: comment.text,
        createdAt: comment.created_at
      };
    });

    return {
      id: item.id,
      uploaderName: item.uploader_name,
      caption: item.caption,
      mediaType: item.media_type,
      publicUrl: normalizeGalleryPublicUrl({
        publicUrl: item.public_url,
        mediaType: item.media_type
      }),
      createdAt: item.created_at,
      likesCount: likedBy.size,
      commentsCount: itemComments.length,
      likedByMe: likedBy.has(attendeeId),
      recentComments
    };
  });

  const payload: MobileNetworkingGalleryFeed = {
    ok: true,
    posts,
    refreshedAt: new Date().toISOString()
  };

  return NextResponse.json(payload);
}
