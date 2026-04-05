import { NextRequest, NextResponse } from "next/server";
import { resolveStaffSession } from "@/lib/mobile/staff-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "staff.read");
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  try {
    const supabase = resolved.session.supabase;

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

    if (participantsTotalResult.error) throw new Error(participantsTotalResult.error.message);
    if (participantsActiveResult.error) throw new Error(participantsActiveResult.error.message);
    if (activePrizesResult.error) throw new Error(activePrizesResult.error.message);
    if (drawTotalResult.error) throw new Error(drawTotalResult.error.message);
    if (prizesResult.error) throw new Error(prizesResult.error.message);
    if (drawsResult.error) throw new Error(drawsResult.error.message);

    const prizes = prizesResult.data ?? [];
    const recentDraws = drawsResult.data ?? [];

    const drawCountByPrize = new Map<string, number>();
    if (prizes.length > 0) {
      const { data: drawTotalsByPrize, error: drawTotalsByPrizeError } = await supabase
        .from("raffle_draws")
        .select("prize_id, draw_number");

      if (drawTotalsByPrizeError) {
        throw new Error(drawTotalsByPrizeError.message);
      }

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
      ok: true,
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Çekiliş özeti alınamadı." },
      { status: 500 }
    );
  }
}
