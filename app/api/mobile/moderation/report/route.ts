import { NextRequest, NextResponse } from "next/server";
import {
  createContentReport,
  isModerationTargetType
} from "@/lib/moderation";
import { resolveMobileSession } from "@/lib/mobile/auth";
import { isValidUuid, normalizeText, readJsonBody } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  targetType?: string;
  targetId?: string | null;
  targetAttendeeId?: string | null;
  reason?: string;
  details?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  if (!resolved.session.attendee?.id) {
    return NextResponse.json({ error: "Rapor göndermek için onboarding tamamlanmalı." }, { status: 400 });
  }

  const body = await readJsonBody<Body>(request);
  const targetType = normalizeText(body.targetType);
  const targetId = normalizeText(body.targetId);
  const targetAttendeeId = normalizeText(body.targetAttendeeId);
  const reason = normalizeText(body.reason) || "objectionable_content";

  if (!isModerationTargetType(targetType)) {
    return NextResponse.json({ error: "Geçersiz rapor hedefi." }, { status: 400 });
  }

  if (targetId && !isValidUuid(targetId)) {
    return NextResponse.json({ error: "Geçersiz içerik kimliği." }, { status: 400 });
  }

  if (targetAttendeeId && !isValidUuid(targetAttendeeId)) {
    return NextResponse.json({ error: "Geçersiz kullanıcı kimliği." }, { status: 400 });
  }

  try {
    const reportId = await createContentReport(resolved.session, {
      targetType,
      targetId: targetId || null,
      targetAttendeeId: targetAttendeeId || null,
      reason,
      action: "report",
      details: {
        ...(body.details ?? {}),
        source: "mobile"
      }
    });

    return NextResponse.json({
      ok: true,
      reportId,
      message: "Rapor alındı. Moderasyon ekibi içeriği 24 saat içinde inceleyecek."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rapor kaydedilemedi." },
      { status: 500 }
    );
  }
}
