import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELETE_CONFIRM_PHRASE = "RESET_REACTIONS";

type ResetPayload = {
  confirm?: string;
};

function getResetSecret() {
  return process.env.DASHBOARD_RESET_SECRET ?? process.env.CRON_SECRET ?? process.env.ANALYZE_API_SECRET ?? "";
}

function isAuthorized(request: NextRequest) {
  return isModeratorRequestAuthorized(request, {
    secret: getResetSecret(),
    secretHeaderName: "x-reset-secret"
  });
}

function getErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Canlı tepkiler sıfırlanırken bir hata oluştu.";
  }

  return error instanceof Error ? error.message : "Beklenmeyen canlı tepki sıfırlama hatası";
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let payload: ResetPayload = {};
  try {
    payload = (await request.json()) as ResetPayload;
  } catch {
    payload = {};
  }

  if (payload.confirm !== DELETE_CONFIRM_PHRASE) {
    return NextResponse.json({ error: "Onay ifadesi eksik veya hatalı." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const countResult = await supabase
      .from("reactions")
      .select("id", { count: "exact", head: true });

    if (countResult.error) {
      throw new Error(`Tepki sayısı alınamadı: ${countResult.error.message}`);
    }

    const deleteResult = await supabase
      .from("reactions")
      .delete()
      .not("id", "is", null);

    if (deleteResult.error) {
      throw new Error(`Tepkiler silinemedi: ${deleteResult.error.message}`);
    }

    return NextResponse.json({
      ok: true,
      deleted_reactions: countResult.count ?? 0
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
