import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DrawPayload = {
  prizeId?: string;
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

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Çekiliş çalıştırılamadı.";
  }

  return error instanceof Error ? error.message : "Çekiliş çalıştırılamadı.";
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let payload: DrawPayload = {};
  try {
    payload = (await request.json()) as DrawPayload;
  } catch {
    payload = {};
  }

  const prizeId = typeof payload.prizeId === "string" ? payload.prizeId.trim() : "";
  if (!isValidUuid(prizeId)) {
    return NextResponse.json({ error: "Geçersiz ödül kimliği." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.rpc("run_raffle_draw", {
      p_prize_id: prizeId
    });

    if (error) {
      throw new Error(error.message);
    }

    const winner = Array.isArray(data) ? data[0] : null;
    if (!winner) {
      throw new Error("Çekiliş sonucu üretilemedi.");
    }

    const [drawCountResult, prizeResult] = await Promise.all([
      supabase.from("raffle_draws").select("id", { count: "exact", head: true }).eq("prize_id", prizeId),
      supabase
        .from("raffle_prizes")
        .select("id, title, quantity")
        .eq("id", prizeId)
        .single()
    ]);

    if (drawCountResult.error) {
      throw new Error(`Ödül çekiliş sayısı alınamadı: ${drawCountResult.error.message}`);
    }

    if (prizeResult.error) {
      throw new Error(`Ödül bilgisi alınamadı: ${prizeResult.error.message}`);
    }

    const drawnCount = drawCountResult.count ?? 0;
    const quantity = prizeResult.data.quantity ?? 0;

    return NextResponse.json({
      ok: true,
      winner: {
        draw_id: winner.draw_id,
        prize_id: winner.prize_id,
        prize_title: winner.prize_title,
        draw_number: winner.draw_number,
        winner_participant_id: winner.winner_participant_id,
        winner_code: winner.winner_code,
        winner_name: winner.winner_name,
        drawn_at: winner.drawn_at
      },
      progress: {
        drawn: drawnCount,
        quantity,
        remaining: Math.max(quantity - drawnCount, 0),
        is_completed: drawnCount >= quantity
      }
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
