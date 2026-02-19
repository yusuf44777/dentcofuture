import { NextRequest, NextResponse } from "next/server";
import {
  DASHBOARD_AUTH_COOKIE_NAME,
  getDashboardCookieMaxAge,
  getDashboardSessionToken,
  isDashboardCredentialValid
} from "@/lib/auth/dashboard";

export const runtime = "nodejs";

type LoginPayload = {
  username?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  let payload: LoginPayload = {};

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    payload = {};
  }

  const username = typeof payload.username === "string" ? payload.username.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!isDashboardCredentialValid(username, password)) {
    return NextResponse.json(
      {
        error: "Kullanıcı adı veya şifre hatalı."
      },
      { status: 401 }
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
