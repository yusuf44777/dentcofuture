import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Çekiliş verisi alınamadı.";
  }

  return error instanceof Error ? error.message : "Çekiliş verisi alınamadı.";
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    const [recentDrawsResult, participantsCountResult, prizesResult, allDrawsResult] = await Promise.all([
      supabase
        .from("raffle_draws")
        .select("id, prize_id, draw_number, winner_code_snapshot, winner_name_snapshot, drawn_at")
        .order("drawn_at", { ascending: false })
        .limit(12),
      supabase.from("raffle_participants").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("raffle_prizes")
        .select("id, title, quantity, is_active, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase.from("raffle_draws").select("prize_id")
    ]);

    if (recentDrawsResult.error) {
      throw new Error(`Son çekilişler alınamadı: ${recentDrawsResult.error.message}`);
    }

    if (participantsCountResult.error) {
      throw new Error(`Katılımcı sayısı alınamadı: ${participantsCountResult.error.message}`);
    }

    if (prizesResult.error) {
      throw new Error(`Ödüller alınamadı: ${prizesResult.error.message}`);
    }

    if (allDrawsResult.error) {
      throw new Error(`Çekiliş sayıları alınamadı: ${allDrawsResult.error.message}`);
    }

    const recentDraws = recentDrawsResult.data ?? [];
    const prizeIds = Array.from(new Set(recentDraws.map((draw) => draw.prize_id)));

    const prizeTitleById = new Map<string, string>();
    if (prizeIds.length > 0) {
      const { data: prizes, error: prizesError } = await supabase
        .from("raffle_prizes")
        .select("id, title")
        .in("id", prizeIds);

      if (prizesError) {
        throw new Error(`Ödül başlıkları alınamadı: ${prizesError.message}`);
      }

      for (const prize of prizes ?? []) {
        prizeTitleById.set(prize.id, prize.title);
      }
    }

    return NextResponse.json({
      participants_active: participantsCountResult.count ?? 0,
      recent_draws: recentDraws.map((draw) => ({
        id: draw.id,
        prize_id: draw.prize_id,
        prize_title: prizeTitleById.get(draw.prize_id) ?? "Ödül",
        draw_number: draw.draw_number,
        winner_code: draw.winner_code_snapshot,
        winner_name: draw.winner_name_snapshot,
        drawn_at: draw.drawn_at
      })),
      active_prizes: (prizesResult.data ?? []).map((prize) => {
        const drawCount = (allDrawsResult.data ?? []).filter((draw) => draw.prize_id === prize.id).length;

        return {
          id: prize.id,
          title: prize.title,
          quantity: prize.quantity,
          draw_count: drawCount,
          remaining: Math.max((prize.quantity ?? 0) - drawCount, 0)
        };
      })
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
