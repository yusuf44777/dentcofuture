import { NextRequest, NextResponse } from "next/server";
import {
  DASHBOARD_AUTH_COOKIE_NAME,
  getDashboardCookieMaxAge,
  getDashboardSessionToken,
  isDashboardCredentialValid
} from "@/lib/auth/dashboard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicServerClient } from "@/lib/supabase/public";

export const runtime = "nodejs";

type LoginPayload = {
  email?: string;
  username?: string;
  password?: string;
};

type StaffRoleAccessRow = {
  is_active: boolean;
};

type SupabaseLoginResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeLoginIdentifier(payload: LoginPayload) {
  const explicitEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (explicitEmail) {
    return explicitEmail;
  }

  return typeof payload.username === "string" ? payload.username.trim() : "";
}

function resolveSupabaseEmail(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  if (isLikelyEmail(normalized)) {
    return normalized;
  }

  const mappedUsername = process.env.DASHBOARD_SUPABASE_USERNAME?.trim().toLowerCase() ?? "";
  const mappedEmail = process.env.DASHBOARD_SUPABASE_EMAIL?.trim().toLowerCase() ?? "";

  if (mappedUsername && mappedEmail && normalized === mappedUsername) {
    return mappedEmail;
  }

  return "";
}

function buildPublicErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Giriş sırasında bir hata oluştu.";
  }

  return error instanceof Error ? error.message : "Giriş sırasında bir hata oluştu.";
}

async function canAuthUserAccessDashboard(authUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("staff_roles")
    .select("is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    // Backward compatibility for old schemas that do not have staff_roles.
    if (error.code === "42P01") {
      return true;
    }

    throw new Error(`Staff rolü doğrulanamadı: ${error.message}`);
  }

  if (!data) {
    return false;
  }

  return (data as StaffRoleAccessRow).is_active === true;
}

async function trySupabaseDashboardSignIn(
  identifier: string,
  password: string
): Promise<SupabaseLoginResult> {
  const email = resolveSupabaseEmail(identifier);
  if (!email) {
    return { ok: false };
  }

  let supabase = null;
  try {
    supabase = createSupabasePublicServerClient();
  } catch {
    // Supabase env yoksa legacy credential fallback devreye girsin.
    return { ok: false };
  }

  const signInResult = await supabase.auth.signInWithPassword({ email, password });
  if (signInResult.error || !signInResult.data.user) {
    return {
      ok: false,
      status: 401,
      error: "Kullanıcı adı veya şifre hatalı."
    };
  }

  const hasAccess = await canAuthUserAccessDashboard(signInResult.data.user.id);
  if (!hasAccess) {
    return {
      ok: false,
      status: 403,
      error: "Bu hesap konuşmacı paneli için yetkilendirilmemiş."
    };
  }

  return { ok: true };
}

export async function POST(request: NextRequest) {
  let payload: LoginPayload = {};

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    payload = {};
  }

  const username = normalizeLoginIdentifier(payload);
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "Kullanıcı adı/e-posta ve şifre gerekli." }, { status: 400 });
  }

  try {
    const supabaseResult = await trySupabaseDashboardSignIn(username, password);
    const isLegacyCredentialValid = isDashboardCredentialValid(username, password);
    const isAuthorized = supabaseResult.ok || isLegacyCredentialValid;

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error: supabaseResult.error ?? "Kullanıcı adı veya şifre hatalı."
        },
        { status: supabaseResult.status ?? 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: DASHBOARD_AUTH_COOKIE_NAME,
      value: getDashboardSessionToken(),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: getDashboardCookieMaxAge()
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: buildPublicErrorMessage(error)
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: DASHBOARD_AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}
