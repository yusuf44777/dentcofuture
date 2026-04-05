import { NextRequest, NextResponse } from "next/server";
import { resolveMobileSession } from "@/lib/mobile/auth";
import { readJsonBody } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  score?: number;
  wave?: number;
};

function computePointsAward(score: number, wave: number) {
  const base = Math.round(score / 450) + wave;
  return Math.max(10, Math.min(60, base));
}

export async function GET(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const supabase = resolved.session.supabase;
  const leaderboardResult = await supabase
    .from("game_scores")
    .select("id, attendee_id, score, wave, created_at, attendee:attendees(name)")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(30);

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
    leaderboard: leaderboardResult.data ?? [],
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
  const wave = Number(body.wave ?? 1);

  if (!Number.isInteger(score) || score < 0 || score > 5_000_000) {
    return NextResponse.json({ error: "Skor geçersiz." }, { status: 400 });
  }

  if (!Number.isInteger(wave) || wave < 1 || wave > 10_000) {
    return NextResponse.json({ error: "Wave değeri geçersiz." }, { status: 400 });
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
