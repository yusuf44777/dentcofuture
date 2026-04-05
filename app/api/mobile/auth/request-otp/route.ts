import { NextRequest, NextResponse } from "next/server";
import { readJsonBody, normalizeText } from "@/lib/mobile/http";
import { createSupabasePublicServerClient } from "@/lib/supabase/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function publicErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "OTP islemi basarisiz oldu.";
  }

  return error instanceof Error ? error.message : "OTP islemi basarisiz oldu.";
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<Body>(request);
    const email = normalizeText(body.email).toLowerCase();

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Gecerli bir e-posta adresi girin." }, { status: 400 });
    }

    const supabase = createSupabasePublicServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true
      }
    });

    if (error) {
      return NextResponse.json({ error: `OTP gonderilemedi: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, email });
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
