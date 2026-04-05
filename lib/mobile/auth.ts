import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Attendee, Json } from "@/lib/types";
import type { MobileRole, MobileStaffRole, StaffCapability } from "@/lib/mobile/contracts";

type StaffRoleRow = {
  role: string;
  capabilities: Json;
  is_active: boolean;
};

export type MobileSession = {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  authUserId: string;
  attendee: Attendee | null;
  role: MobileRole;
  staffRole: MobileStaffRole | null;
};

const ROLE_DEFAULT_CAPABILITIES: Record<string, StaffCapability[]> = {
  moderator: ["staff.read"],
  operator: ["staff.read", "live.polls.write", "live.questions.write", "participants.write"],
  raffle_admin: ["staff.read", "raffle.write", "participants.write"],
  admin: [
    "staff.read",
    "live.polls.write",
    "live.questions.write",
    "raffle.write",
    "participants.write"
  ]
};

function parseCapabilities(value: Json, role: string): StaffCapability[] {
  const defaults = ROLE_DEFAULT_CAPABILITIES[role] ?? ["staff.read"];
  if (!Array.isArray(value)) {
    return defaults;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item): item is StaffCapability =>
      item === "staff.read" ||
      item === "live.polls.write" ||
      item === "live.questions.write" ||
      item === "raffle.write" ||
      item === "participants.write"
    );

  return normalized.length > 0 ? Array.from(new Set(normalized)) : defaults;
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header) return "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
}

export function unauthorized(message = "Yetkisiz erişim.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Bu işlem için yetkiniz yok.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function resolveMobileSession(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return { errorResponse: unauthorized("Authorization Bearer token gerekli.") };
  }

  const supabase = createSupabaseAdminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return { errorResponse: unauthorized("Geçersiz veya süresi dolmuş oturum.") };
  }

  const authUserId = userData.user.id;

  const attendeeResult = await supabase
    .from("attendees")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  let attendee: Attendee | null = null;
  if (!attendeeResult.error && attendeeResult.data) {
    attendee = attendeeResult.data as Attendee;
  }

  let staffRole: MobileStaffRole | null = null;
  const staffResult = await supabase
    .from("staff_roles")
    .select("role, capabilities, is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!staffResult.error && staffResult.data) {
    const row = staffResult.data as StaffRoleRow;
    const normalizedRole = (row.role || "moderator").trim().toLowerCase();
    staffRole = {
      role: normalizedRole,
      capabilities: parseCapabilities(row.capabilities, normalizedRole),
      isActive: row.is_active === true
    };
  }

  const role: MobileRole = staffRole?.isActive ? "staff" : "participant";

  return {
    session: {
      supabase,
      authUserId,
      attendee,
      role,
      staffRole
    } satisfies MobileSession
  };
}

export function hasStaffCapability(session: MobileSession, capability: StaffCapability) {
  if (session.role !== "staff" || !session.staffRole?.isActive) {
    return false;
  }

  return session.staffRole.capabilities.includes(capability);
}
