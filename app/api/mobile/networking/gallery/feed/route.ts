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
  file_path: string;
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
const FEED_FETCH_EXPANSION_FACTOR = 4;

function clampLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(6, Math.min(36, Math.floor(parsed)));
}

function resolveBatchKeyFromPath(filePath: string, fallbackId: string) {
  const fileName = filePath.split("/").pop() ?? "";
  const fileStem = fileName.replace(/\.[^.]+$/, "");
  const batchMatch = fileStem.match(/^([a-z0-9]{8,28})__/i);

  if (!batchMatch?.[1]) {
    return `single:${fallbackId}`;
  }

  return `batch:${batchMatch[1].toLowerCase()}`;
}

function groupGalleryItems(items: GalleryItemRow[], limit: number) {
  const grouped = new Map<string, GalleryItemRow[]>();

  for (const item of items) {
    const key = resolveBatchKeyFromPath(item.file_path, item.id);
    const existing = grouped.get(key) ?? [];
    existing.push(item);
    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .map((groupItems) => {
      const newestCreatedAt = groupItems.reduce((latest, item) => {
        if (!latest) {
          return item.created_at;
        }
        return item.created_at > latest ? item.created_at : latest;
      }, "");

      return {
        items: groupItems,
        newestCreatedAt
      };
    })
    .sort((left, right) => right.newestCreatedAt.localeCompare(left.newestCreatedAt))
    .slice(0, limit);
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

  const fetchLimit = Math.max(12, Math.min(120, limit * FEED_FETCH_EXPANSION_FACTOR));

  const itemsResult = await resolved.session.supabase
    .from("event_gallery_items")
    .select("id, uploader_name, caption, media_type, public_url, file_path, created_at")
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (itemsResult.error) {
    return NextResponse.json(
      { error: `Galeri akışı alınamadı: ${itemsResult.error.message}` },
      { status: 500 }
    );
  }

  const items = (itemsResult.data ?? []) as GalleryItemRow[];
  const groupedItems = groupGalleryItems(items, limit);

  if (groupedItems.length === 0) {
    const payload: MobileNetworkingGalleryFeed = {
      ok: true,
      posts: [],
      refreshedAt: new Date().toISOString()
    };
    return NextResponse.json(payload);
  }

  const itemIds = groupedItems.flatMap((group) => group.items.map((item) => item.id));

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

  const posts = groupedItems.map((group) => {
    const orderedMedia = [...group.items].sort((left, right) =>
      left.created_at.localeCompare(right.created_at)
    );
    const coverItem = orderedMedia[0] ?? group.items[0];
    const mediaItems = orderedMedia.map((item) => ({
      id: item.id,
      mediaType: item.media_type,
      publicUrl: normalizeGalleryPublicUrl({
        publicUrl: item.public_url,
        mediaType: item.media_type
      })
    }));

    const likedAttendeeIds = new Set<string>();
    const mergedComments: GalleryCommentRow[] = [];

    for (const mediaItem of orderedMedia) {
      const likedBy = likeSetByItemId.get(mediaItem.id);
      if (likedBy) {
        for (const likeAttendeeId of likedBy) {
          likedAttendeeIds.add(likeAttendeeId);
        }
      }

      const mediaComments = commentsByItemId.get(mediaItem.id) ?? [];
      mergedComments.push(...mediaComments);
    }

    mergedComments.sort((left, right) => right.created_at.localeCompare(left.created_at));

    const recentComments: MobileNetworkingGalleryComment[] = mergedComments
      .slice(0, 3)
      .map((comment) => {
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

    const caption =
      orderedMedia.find((item) => typeof item.caption === "string" && item.caption.trim().length > 0)
        ?.caption ?? null;

    return {
      id: coverItem.id,
      uploaderName: coverItem.uploader_name,
      caption,
      mediaType: mediaItems[0]?.mediaType ?? coverItem.media_type,
      publicUrl: mediaItems[0]?.publicUrl ?? normalizeGalleryPublicUrl({
        publicUrl: coverItem.public_url,
        mediaType: coverItem.media_type
      }),
      mediaItems,
      mediaCount: mediaItems.length,
      createdAt: group.newestCreatedAt,
      likesCount: likedAttendeeIds.size,
      commentsCount: mergedComments.length,
      likedByMe: likedAttendeeIds.has(attendeeId),
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
