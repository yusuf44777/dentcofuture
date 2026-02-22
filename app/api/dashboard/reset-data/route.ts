import { NextRequest, NextResponse } from "next/server";
import {
  DASHBOARD_AUTH_COOKIE_NAME,
  isDashboardSessionValid
} from "@/lib/auth/dashboard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELETE_CONFIRM_PHRASE = "DELETE_MESSAGES";

type ResetPayload = {
  confirm?: string;
};

function getResetSecret() {
  return process.env.DASHBOARD_RESET_SECRET ?? process.env.CRON_SECRET ?? process.env.ANALYZE_API_SECRET ?? "";
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return "";
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

function isSecretAuthorized(request: NextRequest) {
  const secret = getResetSecret();
  if (!secret) {
    return false;
  }

  const bearerToken = getBearerToken(request);
  const headerSecret = request.headers.get("x-reset-secret")?.trim() ?? "";
  return bearerToken === secret || headerSecret === secret;
}

function isModeratorAuthorized(request: NextRequest) {
  const sessionToken = request.cookies.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;
  return isDashboardSessionValid(sessionToken);
}

function isAuthorized(request: NextRequest) {
  return isModeratorAuthorized(request) || isSecretAuthorized(request);
}

function getErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Veritabanı temizlenirken bir hata oluştu.";
  }

  return error instanceof Error ? error.message : "Beklenmeyen veritabanı temizleme hatası";
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error: "Yetkisiz erişim."
      },
      { status: 401 }
    );
  }

  let payload: ResetPayload = {};
  try {
    payload = (await request.json()) as ResetPayload;
  } catch {
    payload = {};
  }

  if (payload.confirm !== DELETE_CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        error: "Onay ifadesi eksik veya hatalı."
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    const [feedbackCountResult, analyticsCountResult] = await Promise.all([
      supabase.from("attendee_feedbacks").select("id", { count: "exact", head: true }),
      supabase.from("congress_analytics").select("id", { count: "exact", head: true })
    ]);

    if (feedbackCountResult.error) {
      throw new Error(`Geri bildirim sayısı alınamadı: ${feedbackCountResult.error.message}`);
    }

    if (analyticsCountResult.error) {
      throw new Error(`Analiz sayısı alınamadı: ${analyticsCountResult.error.message}`);
    }

    const [feedbackDeleteResult, analyticsDeleteResult] = await Promise.all([
      supabase.from("attendee_feedbacks").delete().not("id", "is", null),
      supabase.from("congress_analytics").delete().not("id", "is", null)
    ]);

    if (feedbackDeleteResult.error) {
      throw new Error(`Geri bildirimler silinemedi: ${feedbackDeleteResult.error.message}`);
    }

    if (analyticsDeleteResult.error) {
      throw new Error(`Analiz kayıtları silinemedi: ${analyticsDeleteResult.error.message}`);
    }

    return NextResponse.json({
      ok: true,
      deleted_feedbacks: feedbackCountResult.count ?? 0,
      deleted_analytics: analyticsCountResult.count ?? 0
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
