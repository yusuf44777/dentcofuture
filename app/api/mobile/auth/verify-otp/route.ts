import { NextRequest, NextResponse } from "next/server";
import { readJsonBody, normalizeText } from "@/lib/mobile/http";
import { createSupabasePublicServerClient } from "@/lib/supabase/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  token?: string;
};

function publicErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "OTP dogrulamasi basarisiz oldu.";
  }

  return error instanceof Error ? error.message : "OTP dogrulamasi basarisiz oldu.";
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<Body>(request);
    const email = normalizeText(body.email).toLowerCase();
    const token = normalizeText(body.token).replace(/\s+/g, "");

    if (!email || !token || token.length < 4) {
      return NextResponse.json({ error: "E-posta ve OTP kodu zorunludur." }, { status: 400 });
    }

    const supabase = createSupabasePublicServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email"
    });

    if (error || !data.session) {
      return NextResponse.json({ error: `OTP dogrulanamadi: ${error?.message ?? "Oturum acilamadi."}` }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      user: data.user,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at
    });
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
