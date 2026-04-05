import { NextRequest, NextResponse } from "next/server";
import { readJsonBody, normalizeText } from "@/lib/mobile/http";
import { createSupabasePublicServerClient } from "@/lib/supabase/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  refreshToken?: string;
};

function publicErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Oturum yenileme basarisiz oldu.";
  }

  return error instanceof Error ? error.message : "Oturum yenileme basarisiz oldu.";
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<Body>(request);
    const refreshToken = normalizeText(body.refreshToken);

    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken zorunludur." }, { status: 400 });
    }

    const supabase = createSupabasePublicServerClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error || !data.session) {
      return NextResponse.json({ error: `Oturum yenilenemedi: ${error?.message ?? "Bilinmeyen hata"}` }, { status: 401 });
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
