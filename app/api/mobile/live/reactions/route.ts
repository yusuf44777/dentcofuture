import { NextRequest, NextResponse } from "next/server";
import { resolveMobileSession } from "@/lib/mobile/auth";
import { readJsonBody } from "@/lib/mobile/http";
import type { ReactionEmoji } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_REACTIONS: ReactionEmoji[] = ["🔥", "💡", "🤯", "👏", "❓"];

type Body = {
  emoji?: ReactionEmoji;
};

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  if (!resolved.session.attendee?.id) {
    return NextResponse.json({ error: "Tepki göndermek için onboarding tamamlanmalı." }, { status: 400 });
  }

  const body = await readJsonBody<Body>(request);
  const emoji = body.emoji;

  if (!emoji || !ALLOWED_REACTIONS.includes(emoji)) {
    return NextResponse.json({ error: "Geçersiz tepki emojisi." }, { status: 400 });
  }

  const supabase = resolved.session.supabase;
  const insertResult = await supabase
    .from("reactions")
    .insert({
      emoji,
      attendee_id: resolved.session.attendee.id,
      session_id: null
    })
    .select("id, emoji, created_at")
    .single();

  if (insertResult.error) {
    return NextResponse.json({ error: `Tepki kaydedilemedi: ${insertResult.error.message}` }, { status: 500 });
  }

  const [emojiCountResult, myCountResult] = await Promise.all([
    supabase.from("reactions").select("id", { count: "exact", head: true }).eq("emoji", emoji),
    supabase
      .from("reactions")
      .select("id", { count: "exact", head: true })
      .eq("attendee_id", resolved.session.attendee.id)
  ]);

  if (emojiCountResult.error || myCountResult.error) {
    return NextResponse.json(
      {
        error:
          emojiCountResult.error?.message ??
          myCountResult.error?.message ??
          "Tepki sayaçları güncellenemedi."
      },
      { status: 500 }
    );
  }

  // Lightweight gamification: every 10 reactions grants +5 points.
  const myReactionCount = myCountResult.count ?? 0;
  if (myReactionCount > 0 && myReactionCount % 10 === 0) {
    const nextPoints = (resolved.session.attendee.points ?? 0) + 5;
    await supabase
      .from("attendees")
      .update({ points: nextPoints })
      .eq("id", resolved.session.attendee.id);
  }

  return NextResponse.json({
    ok: true,
    reaction: insertResult.data,
    emojiCount: emojiCountResult.count ?? 0,
    myReactionCount
  });
}
