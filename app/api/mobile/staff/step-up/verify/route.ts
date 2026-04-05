import { NextRequest, NextResponse } from "next/server";
import { verifyStaffStepUpToken } from "@/lib/mobile/staff";
import { resolveStaffSession } from "@/lib/mobile/staff-guard";
import type { StaffCapability } from "@/lib/mobile/contracts";
import { readJsonBody } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  token?: string;
  capability?: StaffCapability;
};

export async function POST(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "staff.read");
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const body = await readJsonBody<Body>(request);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const capability = body.capability;

  if (!token) {
    return NextResponse.json({ error: "Token zorunludur." }, { status: 400 });
  }

  if (capability && !resolved.session.staffRole?.capabilities.includes(capability)) {
    return NextResponse.json({ ok: true, valid: false });
  }

  const valid = verifyStaffStepUpToken(token, resolved.session.authUserId, capability);

  return NextResponse.json({
    ok: true,
    valid,
    capability: capability ?? null
  });
}
