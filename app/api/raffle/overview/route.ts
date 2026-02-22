import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RaffleDrawRow, RafflePrizeRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return "Çekiliş özeti alınamadı.";
  }

  return error instanceof Error ? error.message : "Çekiliş özeti alınamadı.";
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const [
      participantsTotalResult,
      participantsActiveResult,
      activePrizesResult,
      drawTotalResult,
      prizesResult,
      drawsResult
    ] = await Promise.all([
      supabase.from("raffle_participants").select("id", { count: "exact", head: true }),
      supabase
        .from("raffle_participants")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("raffle_prizes")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase.from("raffle_draws").select("id", { count: "exact", head: true }),
      supabase
        .from("raffle_prizes")
        .select("id, title, description, quantity, allow_previous_winner, is_active, created_at, updated_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("raffle_draws")
        .select(
          "id, prize_id, winner_participant_id, draw_number, winner_code_snapshot, winner_name_snapshot, drawn_at"
        )
        .order("drawn_at", { ascending: false })
        .limit(40)
    ]);

    if (participantsTotalResult.error) {
      throw new Error(`Katılımcı sayısı alınamadı: ${participantsTotalResult.error.message}`);
    }
    if (participantsActiveResult.error) {
      throw new Error(`Aktif katılımcı sayısı alınamadı: ${participantsActiveResult.error.message}`);
    }
    if (activePrizesResult.error) {
      throw new Error(`Aktif ödül sayısı alınamadı: ${activePrizesResult.error.message}`);
    }
    if (drawTotalResult.error) {
      throw new Error(`Çekiliş sayısı alınamadı: ${drawTotalResult.error.message}`);
    }
    if (prizesResult.error) {
      throw new Error(`Ödüller alınamadı: ${prizesResult.error.message}`);
    }
    if (drawsResult.error) {
      throw new Error(`Son çekilişler alınamadı: ${drawsResult.error.message}`);
    }

    const prizes = (prizesResult.data ?? []) as RafflePrizeRow[];
    const recentDraws = (drawsResult.data ?? []) as RaffleDrawRow[];

    const drawCountByPrize = new Map<string, number>();
    for (const draw of recentDraws) {
      drawCountByPrize.set(draw.prize_id, (drawCountByPrize.get(draw.prize_id) ?? 0) + 1);
    }

    // Draw count must include all historic draws, not only the limited recent list.
    if (prizes.length > 0) {
      const { data: drawTotalsByPrize, error: drawTotalsByPrizeError } = await supabase
        .from("raffle_draws")
        .select("prize_id, draw_number");

      if (drawTotalsByPrizeError) {
        throw new Error(`Ödül bazlı çekiliş sayıları alınamadı: ${drawTotalsByPrizeError.message}`);
      }

      drawCountByPrize.clear();
      for (const draw of drawTotalsByPrize ?? []) {
        drawCountByPrize.set(draw.prize_id, (drawCountByPrize.get(draw.prize_id) ?? 0) + 1);
      }
    }

    const prizeTitleById = new Map(prizes.map((prize) => [prize.id, prize.title]));
    const prizeSummaries = prizes.map((prize) => {
      const drawCount = drawCountByPrize.get(prize.id) ?? 0;
      return {
        ...prize,
        draw_count: drawCount,
        remaining: Math.max(prize.quantity - drawCount, 0),
        is_completed: drawCount >= prize.quantity
      };
    });

    return NextResponse.json({
      stats: {
        participants_total: participantsTotalResult.count ?? 0,
        participants_active: participantsActiveResult.count ?? 0,
        active_prizes: activePrizesResult.count ?? 0,
        total_draws: drawTotalResult.count ?? 0
      },
      prizes: prizeSummaries,
      recent_draws: recentDraws.map((draw) => ({
        id: draw.id,
        prize_id: draw.prize_id,
        prize_title: prizeTitleById.get(draw.prize_id) ?? "Ödül",
        draw_number: draw.draw_number,
        winner_code: draw.winner_code_snapshot,
        winner_name: draw.winner_name_snapshot,
        drawn_at: draw.drawn_at
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
