import { NextRequest, NextResponse } from "next/server";
import {
  blockAttendee,
  isModerationTargetType
} from "@/lib/moderation";
import { resolveMobileSession } from "@/lib/mobile/auth";
import { isValidUuid, normalizeText, readJsonBody } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  blockedAttendeeId?: string;
  targetType?: string;
  targetId?: string | null;
  reason?: string;
  details?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  if (!resolved.session.attendee?.id) {
    return NextResponse.json({ error: "Kullanıcı engellemek için onboarding tamamlanmalı." }, { status: 400 });
  }

  const body = await readJsonBody<Body>(request);
  const blockedAttendeeId = normalizeText(body.blockedAttendeeId);
  const targetType = normalizeText(body.targetType);
  const targetId = normalizeText(body.targetId);
  const reason = normalizeText(body.reason) || "abusive_user";

  if (!isValidUuid(blockedAttendeeId)) {
    return NextResponse.json({ error: "Geçersiz kullanıcı kimliği." }, { status: 400 });
  }

  if (!isModerationTargetType(targetType)) {
    return NextResponse.json({ error: "Geçersiz engelleme hedefi." }, { status: 400 });
  }

  if (targetId && !isValidUuid(targetId)) {
    return NextResponse.json({ error: "Geçersiz içerik kimliği." }, { status: 400 });
  }

  try {
    const result = await blockAttendee(resolved.session, {
      blockedAttendeeId,
      targetType,
      targetId: targetId || null,
      reason,
      details: {
        ...(body.details ?? {}),
        source: "mobile"
      }
    });

    return NextResponse.json({
      ok: true,
      blockedAttendeeId,
      blockId: result.blockId,
      reportId: result.reportId,
      message: "Kullanıcı engellendi ve moderasyon ekibine bildirildi."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kullanıcı engellenemedi." },
      { status: 500 }
    );
  }
}
