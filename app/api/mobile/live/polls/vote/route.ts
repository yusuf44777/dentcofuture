import { NextRequest, NextResponse } from "next/server";
import { resolveMobileSession } from "@/lib/mobile/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  pollId?: string;
  optionIndex?: number;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  if (!resolved.session.attendee?.id) {
    return NextResponse.json({ error: "Anket oyu için onboarding tamamlanmalı." }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const pollId = typeof body.pollId === "string" ? body.pollId.trim() : "";
  const optionIndex = Number(body.optionIndex);
  if (!isValidUuid(pollId)) {
    return NextResponse.json({ error: "Geçersiz poll kimliği." }, { status: 400 });
  }
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 9) {
    return NextResponse.json({ error: "Geçersiz seçenek." }, { status: 400 });
  }

  const supabase = resolved.session.supabase;
  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .select("id, options, results, active")
    .eq("id", pollId)
    .maybeSingle();

  if (pollError) {
    return NextResponse.json({ error: `Anket okunamadı: ${pollError.message}` }, { status: 500 });
  }
  if (!poll || !poll.active) {
    return NextResponse.json({ error: "Aktif anket bulunamadı." }, { status: 404 });
  }

  const options = Array.isArray(poll.options) ? poll.options : [];
  if (optionIndex >= options.length) {
    return NextResponse.json({ error: "Seçenek anket aralığı dışında." }, { status: 400 });
  }

  const voteInsert = await supabase.from("poll_votes").insert({
    poll_id: pollId,
    attendee_id: resolved.session.attendee.id,
    option_index: optionIndex
  });

  if (voteInsert.error) {
    if (voteInsert.error.code === "23505") {
      return NextResponse.json({ ok: true, alreadyVoted: true });
    }
    return NextResponse.json({ error: `Oy kaydedilemedi: ${voteInsert.error.message}` }, { status: 500 });
  }

  const results = { ...(poll.results && typeof poll.results === "object" ? poll.results : {}) } as Record<string, number>;
  const key = String(optionIndex);
  results[key] = (Number(results[key]) || 0) + 1;

  const { error: updateError } = await supabase
    .from("polls")
    .update({ results })
    .eq("id", pollId);

  if (updateError) {
    return NextResponse.json({ error: `Anket sonucu güncellenemedi: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyVoted: false, results });
}
