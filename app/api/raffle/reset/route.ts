import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResetPayload = {
  confirm?: string;
};

function getRaffleAdminSecret() {
  return process.env.RAFFLE_ADMIN_SECRET ?? "";
}

function isAuthorized(request: NextRequest) {
  return isModeratorRequestAuthorized(request, {
    secret: getRaffleAdminSecret(),
    secretHeaderName: "x-raffle-secret"
  });
}

function getErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Çekiliş sıfırlanamadı.";
  }

  return error instanceof Error ? error.message : "Çekiliş sıfırlanamadı.";
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

  if (payload.confirm !== "RESET_RAFFLE_DRAWS") {
    return NextResponse.json({ error: "Sıfırlama onayı eksik." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("raffle_draws")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")
      .select("id");

    if (error) {
      throw new Error(`Çekiliş sonuçları silinemedi: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      deleted_draws: data?.length ?? 0
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
