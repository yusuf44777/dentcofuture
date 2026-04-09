import { NextRequest, NextResponse } from "next/server";
import { isValidUuid, readJsonBody } from "@/lib/mobile/http";
import { logStaffOperation } from "@/lib/mobile/staff";
import { resolveStaffSession } from "@/lib/mobile/staff-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  pollId?: string;
  question?: string;
  options?: string[];
  sessionId?: string | null;
};

const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const dedupe = new Set<string>();
  const options: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const normalized = normalizeText(item).slice(0, 80);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLocaleLowerCase("tr-TR");
    if (dedupe.has(key)) {
      continue;
    }

    dedupe.add(key);
    options.push(normalized);
  }

  return options.slice(0, MAX_OPTIONS);
}

export async function GET(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "staff.read");
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const [activeResult, liveActiveResult, recentResult] = await Promise.all([
    resolved.session.supabase.from("polls").select("*").eq("active", true).maybeSingle(),
    resolved.session.supabase
      .from("live_polls")
      .select("id, question, options, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    resolved.session.supabase
      .from("polls")
      .select("id, question, options, results, active, session_id, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (activeResult.error) {
    return NextResponse.json({ error: `Aktif anket alınamadı: ${activeResult.error.message}` }, { status: 500 });
  }
  if (liveActiveResult.error) {
    return NextResponse.json(
      { error: `Canlı aktif anket alınamadı: ${liveActiveResult.error.message}` },
      { status: 500 }
    );
  }

  if (recentResult.error) {
    return NextResponse.json({ error: `Anket listesi alınamadı: ${recentResult.error.message}` }, { status: 500 });
  }

  const mappedLivePoll = liveActiveResult.data
    ? {
        id: liveActiveResult.data.id,
        question: liveActiveResult.data.question,
        options: Array.isArray(liveActiveResult.data.options)
          ? liveActiveResult.data.options.filter((item): item is string => typeof item === "string")
          : [],
        results: {},
        active: true,
        session_id: null,
        created_at: liveActiveResult.data.created_at
      }
    : null;

  return NextResponse.json({
    ok: true,
    activePoll: activeResult.data ?? mappedLivePoll,
    polls: recentResult.data ?? []
  });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "live.polls.write", { requireStepUp: true });
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const body = await readJsonBody<Body>(request);
  const question = normalizeText(body.question).slice(0, 200);
  const options = sanitizeOptions(body.options);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";

  if (question.length < 6) {
    return NextResponse.json({ error: "Soru en az 6 karakter olmalı." }, { status: 400 });
  }

  if (options.length < MIN_OPTIONS) {
    return NextResponse.json({ error: `En az ${MIN_OPTIONS} seçenek girilmeli.` }, { status: 400 });
  }

  if (sessionId && !isValidUuid(sessionId)) {
    return NextResponse.json({ error: "Geçersiz session kimliği." }, { status: 400 });
  }

  try {
    const { error: closeError } = await resolved.session.supabase
      .from("polls")
      .update({ active: false })
      .eq("active", true);

    if (closeError) {
      throw new Error(closeError.message);
    }

    const results = options.reduce((acc, _, index) => {
      acc[String(index)] = 0;
      return acc;
    }, {} as Record<string, number>);

    const { data, error } = await resolved.session.supabase
      .from("polls")
      .insert({
        question,
        options,
        results,
        active: true,
        session_id: sessionId || null
      })
      .select("id, question, options, results, active, session_id, created_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await logStaffOperation(resolved.session, {
      operation: "staff.live.polls.publish",
      targetType: "poll",
      targetId: data.id,
      success: true,
      details: { question, options }
    });

    return NextResponse.json({ ok: true, poll: data, message: "Anket yayınlandı." });
  } catch (error) {
    await logStaffOperation(resolved.session, {
      operation: "staff.live.polls.publish",
      targetType: "poll",
      success: false,
      details: {
        question,
        options,
        error: error instanceof Error ? error.message : "Bilinmeyen hata"
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Anket yayınlanamadı." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "live.polls.write", { requireStepUp: true });
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const body = await readJsonBody<Body>(request);
  const pollId = typeof body.pollId === "string" ? body.pollId.trim() : "";

  if (pollId && !isValidUuid(pollId)) {
    return NextResponse.json({ error: "Geçersiz poll kimliği." }, { status: 400 });
  }

  try {
    let query = resolved.session.supabase
      .from("polls")
      .update({ active: false });

    query = pollId ? query.eq("id", pollId) : query.eq("active", true);

    const { error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    await logStaffOperation(resolved.session, {
      operation: "staff.live.polls.close",
      targetType: "poll",
      targetId: pollId || undefined,
      success: true,
      details: { pollId: pollId || null }
    });

    return NextResponse.json({ ok: true, pollId: pollId || null, message: "Anket kapatıldı." });
  } catch (error) {
    await logStaffOperation(resolved.session, {
      operation: "staff.live.polls.close",
      targetType: "poll",
      targetId: pollId || undefined,
      success: false,
      details: {
        pollId: pollId || null,
        error: error instanceof Error ? error.message : "Bilinmeyen hata"
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Anket kapatılamadı." },
      { status: 500 }
    );
  }
}
