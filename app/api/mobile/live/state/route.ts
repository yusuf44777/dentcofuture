import { NextRequest, NextResponse } from "next/server";
import { parsePollResponse } from "@/lib/engagement";
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
  const [questionsResult, pollResult, livePollResult, reactionsResult, leaderboardResult] = await Promise.all([
    supabase
      .from("questions")
      .select("id, text, votes, answered, pinned, created_at, attendee_id, attendee:attendees(name, role)")
      .order("pinned", { ascending: false })
      .order("votes", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(40),
    supabase.from("polls").select("*").eq("active", true).limit(1).maybeSingle(),
    supabase
      .from("live_polls")
      .select("id, question, options, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("reactions").select("emoji"),
    supabase.from("attendees").select("id, name, role, points").order("points", { ascending: false }).limit(20)
  ]);

  if (questionsResult.error) {
    return NextResponse.json({ error: `Sorular alınamadı: ${questionsResult.error.message}` }, { status: 500 });
  }
  if (pollResult.error) {
    return NextResponse.json({ error: `Anket alınamadı: ${pollResult.error.message}` }, { status: 500 });
  }
  if (livePollResult.error) {
    return NextResponse.json({ error: `Canlı anket alınamadı: ${livePollResult.error.message}` }, { status: 500 });
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

  let activePoll = pollResult.data as MobileLiveState["activePoll"];
  const pollTotals: Record<string, number> = {};

  if (!activePoll && livePollResult.data) {
    const liveOptionsRaw = Array.isArray(livePollResult.data.options) ? livePollResult.data.options : [];
    const liveOptions = liveOptionsRaw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 10);

    activePoll = {
      id: livePollResult.data.id,
      question: livePollResult.data.question,
      options: liveOptions,
      results: {},
      active: true,
      session_id: null,
      created_at: livePollResult.data.created_at
    };

    for (let index = 0; index < liveOptions.length; index += 1) {
      pollTotals[String(index)] = 0;
    }

    const [votesResult, feedbackResult] = await Promise.all([
      supabase.from("poll_votes").select("option_index").eq("poll_id", activePoll.id),
      supabase.from("attendee_feedbacks").select("message").order("created_at", { ascending: false }).limit(2000)
    ]);

    if (votesResult.error) {
      return NextResponse.json({ error: `Poll oyları alınamadı: ${votesResult.error.message}` }, { status: 500 });
    }

    if (feedbackResult.error) {
      return NextResponse.json(
        { error: `Poll geri bildirimleri alınamadı: ${feedbackResult.error.message}` },
        { status: 500 }
      );
    }

    for (const row of votesResult.data ?? []) {
      const idx = Number(row.option_index);
      if (Number.isInteger(idx) && idx >= 0 && idx < liveOptions.length) {
        const key = String(idx);
        pollTotals[key] = (Number(pollTotals[key]) || 0) + 1;
      }
    }

    const optionIndexByName = new Map<string, number>();
    liveOptions.forEach((option, index) => {
      optionIndexByName.set(option.toLocaleLowerCase("tr-TR"), index);
    });

    for (const row of feedbackResult.data ?? []) {
      const parsed = parsePollResponse(row.message ?? "");
      if (!parsed || parsed.pollId !== activePoll.id) {
        continue;
      }

      const matchedIndex = optionIndexByName.get(parsed.option.toLocaleLowerCase("tr-TR"));
      if (matchedIndex === undefined) {
        continue;
      }

      const key = String(matchedIndex);
      pollTotals[key] = (Number(pollTotals[key]) || 0) + 1;
    }
  }

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
