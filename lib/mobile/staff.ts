import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import type { Json } from "@/lib/types";
import type { StaffCapability } from "@/lib/mobile/contracts";
import type { MobileSession } from "@/lib/mobile/auth";

type StepUpPayload = {
  uid: string;
  cap: StaffCapability[];
  exp: number;
  jti: string;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getStepUpSecret() {
  return (
    process.env.MOBILE_STAFF_STEPUP_SECRET ??
    process.env.CRON_SECRET ??
    process.env.DASHBOARD_AUTH_SECRET ??
    "unsafe-mobile-stepup-secret"
  );
}

function signTokenSegment(segment: string) {
  return createHmac("sha256", getStepUpSecret()).update(segment).digest("base64url");
}

export function createStaffStepUpToken(
  authUserId: string,
  capabilities: StaffCapability[],
  ttlSeconds = 5 * 60
) {
  const now = Math.floor(Date.now() / 1000);
  const payload: StepUpPayload = {
    uid: authUserId,
    cap: capabilities,
    exp: now + Math.max(30, ttlSeconds),
    jti: randomUUID()
  };

  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signatureSegment = signTokenSegment(payloadSegment);
  return `${payloadSegment}.${signatureSegment}`;
}

export function verifyStaffStepUpToken(
  token: string,
  authUserId: string,
  requiredCapability?: StaffCapability
) {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const payloadSegment = parts[0] ?? "";
  const signatureSegment = parts[1] ?? "";
  if (!payloadSegment || !signatureSegment) return false;

  const expectedSignature = signTokenSegment(payloadSegment);
  if (expectedSignature.length !== signatureSegment.length) return false;
  if (!timingSafeEqual(Buffer.from(signatureSegment), Buffer.from(expectedSignature))) return false;

  let payload: StepUpPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadSegment)) as StepUpPayload;
  } catch {
    return false;
  }

  if (!payload || payload.uid !== authUserId) return false;
  if (!Array.isArray(payload.cap) || typeof payload.exp !== "number") return false;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return false;

  if (requiredCapability && !payload.cap.includes(requiredCapability)) return false;
  return true;
}

export function getStepUpTokenFromRequest(request: NextRequest) {
  return request.headers.get("x-staff-stepup-token")?.trim() ?? "";
}

export async function logStaffOperation(
  session: MobileSession,
  params: {
    operation: string;
    targetType?: string;
    targetId?: string;
    success: boolean;
    details?: Json;
  }
) {
  await session.supabase.from("staff_operation_audits").insert({
    auth_user_id: session.authUserId,
    attendee_id: session.attendee?.id ?? null,
    operation: params.operation,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    success: params.success,
    details: params.details ?? {}
  });
}
