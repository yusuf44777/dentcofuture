import { NextRequest, NextResponse } from "next/server";
import { resolveMobileSession } from "@/lib/mobile/auth";
import type { MobileMe } from "@/lib/mobile/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const payload: MobileMe = {
    ok: true,
    authUserId: resolved.session.authUserId,
    role: resolved.session.role,
    attendee: resolved.session.attendee,
    staffRole: resolved.session.staffRole
  };

  return NextResponse.json(payload);
}
