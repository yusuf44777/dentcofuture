import { NextRequest, NextResponse } from "next/server";
import { isValidUuid, readJsonBody } from "@/lib/mobile/http";
import { logStaffOperation } from "@/lib/mobile/staff";
import { resolveStaffSession } from "@/lib/mobile/staff-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  prizeId?: string;
};

export async function POST(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "raffle.write", { requireStepUp: true });
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const body = await readJsonBody<Body>(request);
  const prizeId = typeof body.prizeId === "string" ? body.prizeId.trim() : "";

  if (!isValidUuid(prizeId)) {
    return NextResponse.json({ error: "Geçersiz ödül kimliği." }, { status: 400 });
  }

  try {
    const supabase = resolved.session.supabase;

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
      throw new Error(drawCountResult.error.message);
    }

    if (prizeResult.error) {
      throw new Error(prizeResult.error.message);
    }

    await logStaffOperation(resolved.session, {
      operation: "staff.raffle.draw",
      targetType: "raffle_prize",
      targetId: prizeId,
      success: true,
      details: {
        draw_id: winner.draw_id,
        winner_participant_id: winner.winner_participant_id,
        winner_code: winner.winner_code,
        winner_name: winner.winner_name
      }
    });

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
    await logStaffOperation(resolved.session, {
      operation: "staff.raffle.draw",
      targetType: "raffle_prize",
      targetId: prizeId,
      success: false,
      details: {
        error: error instanceof Error ? error.message : "Bilinmeyen hata"
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Çekiliş çalıştırılamadı." },
      { status: 500 }
    );
  }
}
