import { NextRequest, NextResponse } from "next/server";
import { createStaffStepUpToken, logStaffOperation } from "@/lib/mobile/staff";
import { resolveStaffSession } from "@/lib/mobile/staff-guard";
import type { StaffCapability } from "@/lib/mobile/contracts";
import { readJsonBody } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  capabilities?: StaffCapability[];
  ttlSeconds?: number;
  reason?: string;
};

export async function POST(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "staff.read");
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const session = resolved.session;
  const body = await readJsonBody<Body>(request);

  const requestedCapabilities = Array.isArray(body.capabilities)
    ? body.capabilities.filter((cap): cap is StaffCapability =>
        session.staffRole?.capabilities.includes(cap) ?? false
      )
    : [];

  const effectiveCapabilities =
    requestedCapabilities.length > 0
      ? requestedCapabilities
      : session.staffRole?.capabilities ?? ["staff.read"];

  if (effectiveCapabilities.length === 0) {
    return NextResponse.json({ error: "Step-up için yetki kapsamı belirlenemedi." }, { status: 400 });
  }

  const ttlSeconds = Number(body.ttlSeconds);
  const safeTtl = Number.isFinite(ttlSeconds)
    ? Math.max(60, Math.min(30 * 60, Math.floor(ttlSeconds)))
    : 5 * 60;

  const token = createStaffStepUpToken(session.authUserId, effectiveCapabilities, safeTtl);

  await logStaffOperation(session, {
    operation: "staff.step_up.create",
    targetType: "step_up_token",
    success: true,
    details: {
      capabilities: effectiveCapabilities,
      ttlSeconds: safeTtl,
      reason: typeof body.reason === "string" ? body.reason.slice(0, 180) : null
    }
  });

  return NextResponse.json({
    ok: true,
    token,
    capabilities: effectiveCapabilities,
    expiresInSeconds: safeTtl
  });
}
