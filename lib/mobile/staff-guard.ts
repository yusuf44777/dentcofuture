import type { NextRequest } from "next/server";
import { forbidden, hasStaffCapability, resolveMobileSession, unauthorized } from "@/lib/mobile/auth";
import type { StaffCapability } from "@/lib/mobile/contracts";
import { getStepUpTokenFromRequest, verifyStaffStepUpToken } from "@/lib/mobile/staff";

export async function resolveStaffSession(
  request: NextRequest,
  capability: StaffCapability,
  options?: {
    requireStepUp?: boolean;
  }
) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved;
  }

  const session = resolved.session;
  if (session.role !== "staff" || !session.staffRole?.isActive) {
    return { errorResponse: forbidden("Bu endpoint sadece staff kullanıcılarına açıktır.") };
  }

  if (!hasStaffCapability(session, capability)) {
    return { errorResponse: forbidden("Bu işlem için gerekli staff yetkisi yok.") };
  }

  if (options?.requireStepUp) {
    const token = getStepUpTokenFromRequest(request);
    if (!token) {
      return { errorResponse: unauthorized("Bu işlem için step-up token gereklidir.") };
    }

    const validToken = verifyStaffStepUpToken(token, session.authUserId, capability);
    if (!validToken) {
      return { errorResponse: unauthorized("Geçersiz veya süresi dolmuş step-up token.") };
    }
  }

  return { session };
}
