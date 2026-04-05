import { NextRequest, NextResponse } from "next/server";
import { createNetworkingInteraction, isValidNetworkingInteractionAction } from "@/lib/networking/service";
import { resolveMobileSession, type MobileSession } from "@/lib/mobile/auth";
import { isValidUuid, readJsonBody } from "@/lib/mobile/http";
import { mapPublicNetworkingProfileToMobile } from "@/lib/mobile/mappers";
import {
  ensureNetworkingProfileForSession,
  getNetworkingProfilesByIds,
  upsertAcceptedMatchFromProfileIds
} from "@/lib/mobile/networking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  targetProfileId?: string;
  action?: "like" | "pass";
};

async function awardMatchPoints(
  session: MobileSession,
  attendeeIds: string[]
) {
  const uniqueIds = Array.from(new Set(attendeeIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return;
  }

  const { data: attendees, error } = await session.supabase
    .from("attendees")
    .select("id, points")
    .in("id", uniqueIds);

  if (error) {
    return;
  }

  await Promise.all(
    (attendees ?? []).map((attendee) =>
      session.supabase
        .from("attendees")
        .update({ points: (attendee.points ?? 0) + 25 })
        .eq("id", attendee.id)
    )
  );
}

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  if (!resolved.session.attendee?.id) {
    return NextResponse.json({ error: "Networking için onboarding tamamlanmalı." }, { status: 400 });
  }

  const actorProfile = await ensureNetworkingProfileForSession(resolved.session);
  if (!actorProfile) {
    return NextResponse.json({ error: "Networking profili bulunamadı." }, { status: 404 });
  }

  const body = await readJsonBody<Body>(request);
  const targetProfileId = typeof body.targetProfileId === "string" ? body.targetProfileId.trim() : "";
  const action = body.action;

  if (!isValidUuid(targetProfileId) || targetProfileId === actorProfile.id) {
    return NextResponse.json({ error: "Geçersiz hedef profil." }, { status: 400 });
  }

  if (!action || !isValidNetworkingInteractionAction(action)) {
    return NextResponse.json({ error: "Geçersiz aksiyon." }, { status: 400 });
  }

  const interaction = await createNetworkingInteraction({
    actorProfileId: actorProfile.id,
    targetProfileId,
    action
  });

  let matchRecord: {
    id: string;
    attendee_a: string;
    attendee_b: string;
    status: string;
    created_at: string;
  } | null = null;

  if (interaction.matched) {
    matchRecord = await upsertAcceptedMatchFromProfileIds(
      resolved.session,
      actorProfile.id,
      targetProfileId
    );

    if (matchRecord) {
      await awardMatchPoints(resolved.session, [matchRecord.attendee_a, matchRecord.attendee_b]);
    }
  }

  const linkedProfiles = await getNetworkingProfilesByIds(resolved.session, [targetProfileId]);

  return NextResponse.json({
    ok: true,
    action,
    actorProfileId: actorProfile.id,
    targetProfileId,
    matched: interaction.matched,
    match: interaction.match
      ? {
          ...interaction.match,
          profile: mapPublicNetworkingProfileToMobile(
            interaction.match.profile,
            linkedProfiles.get(interaction.match.profile.id)?.attendee_id ?? null
          )
        }
      : null,
    acceptedMatch: matchRecord
  });
}
