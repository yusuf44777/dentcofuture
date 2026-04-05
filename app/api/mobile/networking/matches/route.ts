import { NextRequest, NextResponse } from "next/server";
import { getNetworkingMatches } from "@/lib/networking/service";
import { resolveMobileSession } from "@/lib/mobile/auth";
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
    return NextResponse.json({ error: "Networking profili bulunamadı." }, { status: 404 });
  }

  const matchesResponse = await getNetworkingMatches(currentProfile.id);
  if (!matchesResponse) {
    return NextResponse.json({ error: "Eşleşmeler alınamadı." }, { status: 500 });
  }

  const profileIds = matchesResponse.matches.map((item) => item.profile.id);
  const linkedProfiles = await getNetworkingProfilesByIds(resolved.session, profileIds);

  const counterpartAttendeeIds = Array.from(
    new Set(
      profileIds
        .map((profileId) => linkedProfiles.get(profileId)?.attendee_id ?? null)
        .filter((id): id is string => Boolean(id))
    )
  );

  let attendeeById = new Map<string, { id: string; name: string; role: string; instagram: string | null; linkedin: string | null }>();
  if (counterpartAttendeeIds.length > 0) {
    const attendeesResult = await resolved.session.supabase
      .from("attendees")
      .select("id, name, role, instagram, linkedin")
      .in("id", counterpartAttendeeIds);

    if (attendeesResult.error) {
      return NextResponse.json({ error: `Eşleşen katılımcılar alınamadı: ${attendeesResult.error.message}` }, { status: 500 });
    }

    attendeeById = new Map(
      (attendeesResult.data ?? []).map((item) => [
        item.id,
        {
          id: item.id,
          name: item.name,
          role: item.role,
          instagram: item.instagram,
          linkedin: item.linkedin
        }
      ])
    );
  }

  return NextResponse.json({
    ok: true,
    total: matchesResponse.total,
    refreshedAt: matchesResponse.refreshedAt,
    matches: matchesResponse.matches.map((match) => {
      const attendeeId = linkedProfiles.get(match.profile.id)?.attendee_id ?? null;
      return {
        matchedAt: match.matchedAt,
        profile: mapPublicNetworkingProfileToMobile(match.profile, attendeeId),
        attendee: attendeeId ? attendeeById.get(attendeeId) ?? null : null
      };
    })
  });
}
