import { NextRequest, NextResponse } from "next/server";
import type { StaffOverview } from "@/lib/mobile/contracts";
import { resolveStaffSession } from "@/lib/mobile/staff-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "staff.read");
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const supabase = resolved.session.supabase;
  const [
    attendees,
    questions,
    activePolls,
    reactions,
    raffleParticipants,
    rafflePrizes,
    raffleDraws,
    feedbacks,
    latestAnalytics
  ] = await Promise.all([
    supabase.from("attendees").select("id", { count: "exact", head: true }),
    supabase.from("questions").select("id", { count: "exact", head: true }),
    supabase.from("polls").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("reactions").select("id", { count: "exact", head: true }),
    supabase.from("raffle_participants").select("id", { count: "exact", head: true }),
    supabase.from("raffle_prizes").select("id", { count: "exact", head: true }),
    supabase.from("raffle_draws").select("id", { count: "exact", head: true }),
    supabase.from("attendee_feedbacks").select("id", { count: "exact", head: true }),
    supabase
      .from("congress_analytics")
      .select("created_at, total_feedbacks, sentiment_score, top_keywords")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const countError =
    attendees.error ??
    questions.error ??
    activePolls.error ??
    reactions.error ??
    raffleParticipants.error ??
    rafflePrizes.error ??
    raffleDraws.error ??
    feedbacks.error;

  if (countError) {
    return NextResponse.json({ error: `Staff overview alınamadı: ${countError.message}` }, { status: 500 });
  }

  if (latestAnalytics.error) {
    return NextResponse.json({ error: `Analytics okunamadı: ${latestAnalytics.error.message}` }, { status: 500 });
  }

  const payload: StaffOverview = {
    ok: true,
    stats: {
      attendees: attendees.count ?? 0,
      questions: questions.count ?? 0,
      activePolls: activePolls.count ?? 0,
      reactions: reactions.count ?? 0,
      raffleParticipants: raffleParticipants.count ?? 0,
      rafflePrizes: rafflePrizes.count ?? 0,
      raffleDraws: raffleDraws.count ?? 0,
      feedbacks: feedbacks.count ?? 0
    },
    latestAnalytics: latestAnalytics.data
      ? {
          created_at: latestAnalytics.data.created_at,
          total_feedbacks: latestAnalytics.data.total_feedbacks,
          sentiment_score: latestAnalytics.data.sentiment_score,
          top_keywords: latestAnalytics.data.top_keywords
        }
      : null
  };

  return NextResponse.json(payload);
}
