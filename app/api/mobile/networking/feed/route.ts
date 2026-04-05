import { NextRequest, NextResponse } from "next/server";
import { getNetworkingFeed } from "@/lib/networking/service";
import { resolveMobileSession } from "@/lib/mobile/auth";
import type { MobileNetworkingFeed } from "@/lib/mobile/contracts";
import { mapPublicNetworkingProfileToMobile } from "@/lib/mobile/mappers";
import { ensureNetworkingProfileForSession, getNetworkingProfilesByIds } from "@/lib/mobile/networking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  if (!resolved.session.attendee?.id) {
    return NextResponse.json({ error: "Networking için onboarding tamamlanmalı." }, { status: 400 });
  }

  const currentProfile = await ensureNetworkingProfileForSession(resolved.session);
  if (!currentProfile) {
    return NextResponse.json({ error: "Networking profili oluşturulamadı." }, { status: 500 });
  }

  const feed = await getNetworkingFeed(currentProfile.id);
  if (!feed) {
    return NextResponse.json({ error: "Networking beslemesi alınamadı." }, { status: 500 });
  }

  const linkedProfiles = await getNetworkingProfilesByIds(resolved.session, [
    ...(feed.currentProfile ? [feed.currentProfile.id] : []),
    ...feed.queue.map((item) => item.id)
  ]);

  const payload: MobileNetworkingFeed = {
    ok: true,
    current: feed.currentProfile
      ? mapPublicNetworkingProfileToMobile(
          feed.currentProfile,
          linkedProfiles.get(feed.currentProfile.id)?.attendee_id ?? null
        )
      : null,
    queue: feed.queue.map((item) =>
      mapPublicNetworkingProfileToMobile(item, linkedProfiles.get(item.id)?.attendee_id ?? null)
    ),
    likesSentCount: feed.likesSentCount,
    mutualMatchesCount: feed.mutualMatchesCount,
    message: feed.message,
    refreshedAt: feed.refreshedAt
  };

  return NextResponse.json(payload);
}
