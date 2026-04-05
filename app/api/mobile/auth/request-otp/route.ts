import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isParticipantAllowed, normalizeEmail, normalizePhone } from "@/lib/mobile/participant-access";
import { readJsonBody } from "@/lib/mobile/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicServerClient } from "@/lib/supabase/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  phone?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return value.length >= 10 && value.length <= 15;
}

function publicErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Giris islemi basarisiz oldu.";
  }

  return error instanceof Error ? error.message : "Giris islemi basarisiz oldu.";
}

function buildLoginPassword(email: string) {
  const secret =
    process.env.MOBILE_LOGIN_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "dentco-outlier-mobile-login";

  const hash = createHash("sha256")
    .update(`${secret}:${email}`)
    .digest("hex");

  return `${hash.slice(0, 28)}Aa9!`;
}

async function findAuthUserIdByEmail(email: string) {
  const admin = createSupabaseAdminClient();
  const perPage = 200;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const matched = users.find((user) => (user.email ?? "").toLowerCase() === email);
    if (matched?.id) {
      return matched.id;
    }

    if (users.length < perPage) {
      break;
    }
  }

  return null;
}

async function ensureUserCanSignIn(email: string, password: string) {
  const admin = createSupabaseAdminClient();
  const existingUserId = await findAuthUserIdByEmail(email);

  if (existingUserId) {
    const { error } = await admin.auth.admin.updateUserById(existingUserId, {
      password,
      email_confirm: true,
      user_metadata: {
        app_name: "DentCo Outlier"
      }
    });

    if (error) {
      throw error;
    }

    return existingUserId;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      app_name: "DentCo Outlier"
    }
  });

  if (error) {
    throw error;
  }

  return data.user?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<Body>(request);
    const email = normalizeEmail(body.email ?? "");
    const phone = normalizePhone(body.phone ?? "");

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Gecerli bir e-posta adresi girin." }, { status: 400 });
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "Gecerli bir telefon numarasi girin." }, { status: 400 });
    }

    if (!isParticipantAllowed(email, phone)) {
      return NextResponse.json(
        { error: "Bu e-posta/telefon katilimci listesinde bulunamadi." },
        { status: 403 }
      );
    }

    const password = buildLoginPassword(email);
    const supabase = createSupabasePublicServerClient();

    let signInResult = await supabase.auth.signInWithPassword({ email, password });
    if (signInResult.error || !signInResult.data.session) {
      await ensureUserCanSignIn(email, password);
      signInResult = await supabase.auth.signInWithPassword({ email, password });
    }

    if (signInResult.error || !signInResult.data.session) {
      return NextResponse.json(
        { error: `Oturum acilamadi: ${signInResult.error?.message ?? "Bilinmeyen hata"}` },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: signInResult.data.user,
      accessToken: signInResult.data.session.access_token,
      refreshToken: signInResult.data.session.refresh_token,
      expiresAt: signInResult.data.session.expires_at
    });
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }
}
