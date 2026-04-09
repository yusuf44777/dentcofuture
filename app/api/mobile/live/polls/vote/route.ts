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

  if (poll && poll.active) {
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

    const results = {
      ...(poll.results && typeof poll.results === "object" ? poll.results : {})
    } as Record<string, number>;
    const key = String(optionIndex);
    results[key] = (Number(results[key]) || 0) + 1;

    const { error: updateError } = await supabase
      .from("polls")
      .update({ results })
      .eq("id", pollId);

    if (updateError) {
      return NextResponse.json(
        { error: `Anket sonucu güncellenemedi: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, alreadyVoted: false, results });
  }

  const livePollResult = await supabase
    .from("live_polls")
    .select("id, question, options, is_active")
    .eq("id", pollId)
    .eq("is_active", true)
    .maybeSingle();

  if (livePollResult.error) {
    return NextResponse.json(
      { error: `Canlı anket okunamadı: ${livePollResult.error.message}` },
      { status: 500 }
    );
  }

  if (!livePollResult.data) {
    return NextResponse.json({ error: "Aktif anket bulunamadı." }, { status: 404 });
  }

  const liveOptions = Array.isArray(livePollResult.data.options)
    ? livePollResult.data.options.filter((item): item is string => typeof item === "string")
    : [];

  if (optionIndex >= liveOptions.length) {
    return NextResponse.json({ error: "Seçenek anket aralığı dışında." }, { status: 400 });
  }

  const initialResults = liveOptions.reduce((acc, _, index) => {
    acc[String(index)] = 0;
    return acc;
  }, {} as Record<string, number>);

  const ensureLegacyPoll = await supabase
    .from("polls")
    .upsert(
      {
        id: pollId,
        question: livePollResult.data.question,
        options: liveOptions,
        results: initialResults,
        active: true,
        session_id: null
      },
      {
        onConflict: "id"
      }
    )
    .select("id, results")
    .single();

  if (ensureLegacyPoll.error) {
    return NextResponse.json(
      { error: `Legacy anket kaydı oluşturulamadı: ${ensureLegacyPoll.error.message}` },
      { status: 500 }
    );
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

  const results = {
    ...(ensureLegacyPoll.data?.results && typeof ensureLegacyPoll.data.results === "object"
      ? ensureLegacyPoll.data.results
      : initialResults)
  } as Record<string, number>;
  const key = String(optionIndex);
  results[key] = (Number(results[key]) || 0) + 1;

  const updateResult = await supabase
    .from("polls")
    .update({ results, active: true })
    .eq("id", pollId);

  if (updateResult.error) {
    return NextResponse.json(
      { error: `Anket sonucu güncellenemedi: ${updateResult.error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, alreadyVoted: false, results });
}
