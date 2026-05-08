import { NextRequest, NextResponse } from "next/server";
import { resolveMobileSession } from "@/lib/mobile/auth";
import { readJsonBody } from "@/lib/mobile/http";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  score?: number;
  wave?: number;
};

type ScoreRow = {
  id: string;
  attendee_id: string;
  score: number;
  wave: number;
  created_at: string;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

type MobileSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

const LEADERBOARD_LIMIT = 30;
const RAW_SCORE_FALLBACK_LIMIT = 1000;

function computePointsAward(score: number, wave: number) {
  const base = Math.round(score / 450) + wave;
  return Math.max(10, Math.min(60, base));
}

function isMissingBestScoresViewError(error: SupabaseErrorLike | null | undefined) {
  if (!error) return false;

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("game_score_bests") &&
      (message.includes("could not find") || message.includes("does not exist") || message.includes("relation")))
  );
}

async function fetchLeaderboardRows(supabase: MobileSupabaseClient) {
  const bestScoresResult = await supabase
    .from("game_score_bests")
    .select("id, attendee_id, score, wave, created_at")
    .eq("wave", 1)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(LEADERBOARD_LIMIT);

  if (!bestScoresResult.error) {
    return { data: (bestScoresResult.data ?? []) as ScoreRow[], error: null };
  }

  if (!isMissingBestScoresViewError(bestScoresResult.error)) {
    return { data: [] as ScoreRow[], error: bestScoresResult.error };
  }

  const rawScoresResult = await supabase
    .from("game_scores")
    .select("id, attendee_id, score, wave, created_at")
    .eq("wave", 1)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(RAW_SCORE_FALLBACK_LIMIT);

  if (rawScoresResult.error) {
    return { data: [] as ScoreRow[], error: rawScoresResult.error };
  }

  const seenAttendeeIds = new Set<string>();
  const bestRows: ScoreRow[] = [];

  for (const row of (rawScoresResult.data ?? []) as ScoreRow[]) {
    if (seenAttendeeIds.has(row.attendee_id)) continue;

    seenAttendeeIds.add(row.attendee_id);
    bestRows.push(row);
    if (bestRows.length >= LEADERBOARD_LIMIT) break;
  }

  return { data: bestRows, error: null };
}

async function attachAttendeeNames(
  supabase: MobileSupabaseClient,
  rows: ScoreRow[]
) {
  const attendeeIds = Array.from(new Set(rows.map((row) => row.attendee_id)));
  if (attendeeIds.length === 0) {
    return { data: rows.map((row) => ({ ...row, attendee: null })), error: null };
  }

  const attendeesResult = await supabase
    .from("attendees")
    .select("id, name")
    .in("id", attendeeIds);

  if (attendeesResult.error) {
    return { data: [], error: attendeesResult.error };
  }

  const attendeeNameById = new Map(
    ((attendeesResult.data ?? []) as { id: string; name: string }[]).map((attendee) => [
      attendee.id,
      { name: attendee.name }
    ])
  );

  return {
    data: rows.map((row) => ({
      ...row,
      attendee: attendeeNameById.get(row.attendee_id) ?? null
    })),
    error: null
  };
}

export async function GET(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const supabase = resolved.session.supabase;
  const leaderboardRowsResult = await fetchLeaderboardRows(supabase);

  if (leaderboardRowsResult.error) {
    return NextResponse.json({ error: `Skor tablosu alınamadı: ${leaderboardRowsResult.error.message}` }, { status: 500 });
  }

  const leaderboardResult = await attachAttendeeNames(supabase, leaderboardRowsResult.data);

  if (leaderboardResult.error) {
    return NextResponse.json({ error: `Skor tablosu alınamadı: ${leaderboardResult.error.message}` }, { status: 500 });
  }

  let personalBest: {
    score: number;
    wave: number;
    created_at: string;
  } | null = null;

  if (resolved.session.attendee?.id) {
    const bestResult = await supabase
      .from("game_scores")
      .select("score, wave, created_at")
      .eq("attendee_id", resolved.session.attendee.id)
      .eq("wave", 1)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (bestResult.error) {
      return NextResponse.json({ error: `Kişisel skor alınamadı: ${bestResult.error.message}` }, { status: 500 });
    }

    personalBest = bestResult.data ?? null;
  }

  return NextResponse.json({
    ok: true,
    leaderboard: leaderboardResult.data,
    personalBest
  });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  if (!resolved.session.attendee?.id) {
    return NextResponse.json({ error: "Skor göndermek için onboarding tamamlanmalı." }, { status: 400 });
  }

  const body = await readJsonBody<Body>(request);
  const score = Number(body.score);
  const wave = 1;

  if (!Number.isInteger(score) || score < 0 || score > 5_000_000) {
    return NextResponse.json({ error: "Skor geçersiz." }, { status: 400 });
  }

  const supabase = resolved.session.supabase;
  const insertResult = await supabase
    .from("game_scores")
    .insert({
      attendee_id: resolved.session.attendee.id,
      score,
      wave
    })
    .select("id, attendee_id, score, wave, created_at")
    .single();

  if (insertResult.error) {
    return NextResponse.json({ error: `Skor kaydedilemedi: ${insertResult.error.message}` }, { status: 500 });
  }

  const pointsAward = computePointsAward(score, wave);
  const nextPoints = (resolved.session.attendee.points ?? 0) + pointsAward;

  const attendeeUpdate = await supabase
    .from("attendees")
    .update({ points: nextPoints })
    .eq("id", resolved.session.attendee.id)
    .select("id, points")
    .maybeSingle();

  if (attendeeUpdate.error) {
    return NextResponse.json({ error: `Puan güncellenemedi: ${attendeeUpdate.error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    score: insertResult.data,
    pointsAward,
    attendee: attendeeUpdate.data
  });
}
