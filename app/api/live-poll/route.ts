import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const QUESTION_MAX_LENGTH = 180;
const OPTION_MAX_LENGTH = 80;

type LivePollRow = {
  id: string;
  question: string;
  options: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type LivePollPayload = {
  question?: unknown;
  options?: unknown;
};

function getPollAdminSecret() {
  return process.env.DASHBOARD_POLL_SECRET ?? process.env.CRON_SECRET ?? "";
}

function isWriteAuthorized(request: NextRequest) {
  return isModeratorRequestAuthorized(request, {
    secret: getPollAdminSecret(),
    secretHeaderName: "x-dashboard-poll-secret"
  });
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (process.env.NODE_ENV === "production") {
    return fallbackMessage;
  }

  return error instanceof Error ? error.message : fallbackMessage;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const dedupe = new Set<string>();
  const options: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const normalized = normalizeText(item).slice(0, OPTION_MAX_LENGTH);
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

function parseOptions(value: Json) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeText(item).slice(0, OPTION_MAX_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_OPTIONS);
}

function mapLivePoll(row: LivePollRow | null) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    question: row.question,
    options: parseOptions(row.options),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getActivePoll() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("live_polls")
    .select("id, question, options, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Aktif anket alınamadı: ${error.message}`);
  }

  return mapLivePoll((data ?? null) as LivePollRow | null);
}

export async function GET() {
  try {
    const activePoll = await getActivePoll();
    return NextResponse.json({ activePoll });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Aktif anket alınamadı.")
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isWriteAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let payload: LivePollPayload = {};
  try {
    payload = (await request.json()) as LivePollPayload;
  } catch {
    payload = {};
  }

  const question = typeof payload.question === "string" ? normalizeText(payload.question) : "";
  const options = sanitizeOptions(payload.options);

  if (question.length < 6) {
    return NextResponse.json(
      {
        error: "Anket sorusu en az 6 karakter olmalıdır."
      },
      { status: 400 }
    );
  }

  if (question.length > QUESTION_MAX_LENGTH) {
    return NextResponse.json(
      {
        error: `Anket sorusu en fazla ${QUESTION_MAX_LENGTH} karakter olabilir.`
      },
      { status: 400 }
    );
  }

  if (options.length < MIN_OPTIONS) {
    return NextResponse.json(
      {
        error: `En az ${MIN_OPTIONS} seçenek girilmelidir.`
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { error: closeError } = await supabase
      .from("live_polls")
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq("is_active", true);

    if (closeError) {
      throw new Error(`Mevcut anket kapatılamadı: ${closeError.message}`);
    }

    const { data: createdPoll, error: createError } = await supabase
      .from("live_polls")
      .insert({
        question: question.slice(0, QUESTION_MAX_LENGTH),
        options,
        is_active: true
      })
      .select("id, question, options, is_active, created_at, updated_at")
      .single();

    if (createError) {
      throw new Error(`Anket yayınlanamadı: ${createError.message}`);
    }

    return NextResponse.json({
      ok: true,
      activePoll: mapLivePoll(createdPoll as LivePollRow),
      message: "Canlı anket yayınlandı."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Anket yayınlanamadı.")
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isWriteAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("live_polls")
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq("is_active", true);

    if (error) {
      throw new Error(`Anket kapatılamadı: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      activePoll: null,
      message: "Aktif anket kapatıldı."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Anket kapatılamadı.")
      },
      { status: 500 }
    );
  }
}
