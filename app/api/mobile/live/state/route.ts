import { NextRequest, NextResponse } from "next/server";
import { resolveMobileSession } from "@/lib/mobile/auth";
import type { MobileLiveState } from "@/lib/mobile/contracts";
import type { ReactionEmoji } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REACTION_KEYS: ReactionEmoji[] = ["🔥", "💡", "🤯", "👏", "❓"];

function emptyReactionCounts() {
  return REACTION_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<ReactionEmoji, number>);
}

export async function GET(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const supabase = resolved.session.supabase;
  const [questionsResult, pollResult, reactionsResult, leaderboardResult] = await Promise.all([
    supabase
      .from("questions")
      .select("id, text, votes, answered, pinned, created_at, attendee_id, attendee:attendees(name, role)")
      .order("pinned", { ascending: false })
      .order("votes", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(40),
    supabase.from("polls").select("*").eq("active", true).limit(1).maybeSingle(),
    supabase.from("reactions").select("emoji"),
    supabase.from("attendees").select("id, name, role, points").order("points", { ascending: false }).limit(20)
  ]);

  if (questionsResult.error) {
    return NextResponse.json({ error: `Sorular alınamadı: ${questionsResult.error.message}` }, { status: 500 });
  }
  if (pollResult.error) {
    return NextResponse.json({ error: `Anket alınamadı: ${pollResult.error.message}` }, { status: 500 });
  }
  if (reactionsResult.error) {
    return NextResponse.json({ error: `Tepkiler alınamadı: ${reactionsResult.error.message}` }, { status: 500 });
  }
  if (leaderboardResult.error) {
    return NextResponse.json({ error: `Liderlik alınamadı: ${leaderboardResult.error.message}` }, { status: 500 });
  }

  const reactionCounts = emptyReactionCounts();
  for (const row of reactionsResult.data ?? []) {
    const emoji = row.emoji as ReactionEmoji;
    if (REACTION_KEYS.includes(emoji)) {
      reactionCounts[emoji] += 1;
    }
  }

  const activePoll = pollResult.data as MobileLiveState["activePoll"];
  const pollTotals: Record<string, number> = {};
  if (activePoll?.results && typeof activePoll.results === "object") {
    for (const [key, value] of Object.entries(activePoll.results)) {
      pollTotals[key] = Number(value) || 0;
    }
  }

  const questions = (questionsResult.data ?? []).map((row) => ({
    id: row.id,
    text: row.text,
    votes: row.votes,
    answered: row.answered,
    pinned: row.pinned,
    created_at: row.created_at,
    attendee_id: row.attendee_id,
    attendee_name: (row.attendee as { name?: string } | null)?.name ?? null,
    attendee_role: (row.attendee as { role?: string } | null)?.role ?? null
  }));

  const payload: MobileLiveState = {
    ok: true,
    questions,
    activePoll,
    pollTotals,
    reactionCounts,
    leaderboard: (leaderboardResult.data ?? []) as MobileLiveState["leaderboard"]
  };

  return NextResponse.json(payload);
}
