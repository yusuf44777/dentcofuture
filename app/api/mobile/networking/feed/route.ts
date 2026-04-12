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
    ...feed.queue.map((item) => item.id),
    ...feed.recommended.map((item) => item.id),
    ...feed.directory.map((item) => item.id)
  ]);

  const attendeeIds = Array.from(
    new Set(
      Array.from(linkedProfiles.values())
        .map((profile) => profile.attendee_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let attendeeById = new Map<
    string,
    {
      role: string | null;
      classLevel: string | null;
      university: string | null;
      instagram: string | null;
      linkedin: string | null;
    }
  >();

  if (attendeeIds.length > 0) {
    const attendeesResult = await resolved.session.supabase
      .from("attendees")
      .select("id, role, class_level, university, instagram, linkedin")
      .in("id", attendeeIds);

    if (attendeesResult.error) {
      return NextResponse.json(
        { error: `Katilimci detaylari alinamadi: ${attendeesResult.error.message}` },
        { status: 500 }
      );
    }

    attendeeById = new Map(
      (attendeesResult.data ?? []).map((item) => [
        item.id,
        {
          role: item.role ?? null,
          classLevel: item.class_level ?? null,
          university: item.university ?? null,
          instagram: item.instagram ?? null,
          linkedin: item.linkedin ?? null
        }
      ])
    );
  }

  const mapProfile = (profile: (typeof feed.recommended)[number]) => {
    const attendeeId = linkedProfiles.get(profile.id)?.attendee_id ?? null;
    return mapPublicNetworkingProfileToMobile(profile, attendeeId, attendeeId ? attendeeById.get(attendeeId) : null);
  };

  const payload: MobileNetworkingFeed = {
    ok: true,
    current: feed.currentProfile ? mapProfile(feed.currentProfile) : null,
    recommended: feed.recommended.map((item) => mapProfile(item)),
    directory: feed.directory.map((item) => mapProfile(item)),
    queue: feed.queue.map((item) => mapProfile(item)),
    likesSentCount: feed.likesSentCount,
    mutualMatchesCount: feed.mutualMatchesCount,
    message: feed.message,
    refreshedAt: feed.refreshedAt
  };

  return NextResponse.json(payload);
}
