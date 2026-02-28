import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import type { Json } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const QUESTION_MAX_LENGTH = 180;
const OPTION_MAX_LENGTH = 80;

type LivePollPresetRow = {
  id: string;
  question: string;
  options: Json;
  created_at: string;
  updated_at: string;
};

type CreatePresetBody = {
  question?: unknown;
  options?: unknown;
};

type DeletePresetBody = {
  presetId?: unknown;
};

function getPollAdminSecret() {
  return process.env.DASHBOARD_POLL_SECRET ?? process.env.CRON_SECRET ?? "";
}

function isAuthorized(request: NextRequest) {
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

function mapPreset(row: LivePollPresetRow) {
  return {
    id: row.id,
    question: row.question,
    options: parseOptions(row.options),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("live_poll_presets")
      .select("id, question, options, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(30);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      presets: ((data ?? []) as LivePollPresetRow[]).map(mapPreset)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Hazır sorular alınamadı.")
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let body: CreatePresetBody = {};
  try {
    body = (await request.json()) as CreatePresetBody;
  } catch {
    body = {};
  }

  const question = typeof body.question === "string" ? normalizeText(body.question) : "";
  const options = sanitizeOptions(body.options);

  if (question.length < 6) {
    return NextResponse.json({ error: "Hazır soru en az 6 karakter olmalıdır." }, { status: 400 });
  }

  if (question.length > QUESTION_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Hazır soru en fazla ${QUESTION_MAX_LENGTH} karakter olabilir.` },
      { status: 400 }
    );
  }

  if (options.length < MIN_OPTIONS) {
    return NextResponse.json(
      { error: `Hazır soru için en az ${MIN_OPTIONS} seçenek girilmelidir.` },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("live_poll_presets")
      .insert({
        question,
        options
      })
      .select("id, question, options, created_at, updated_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      preset: mapPreset(data as LivePollPresetRow),
      message: "Hazır soru kaydedildi."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Hazır soru kaydedilemedi.")
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let body: DeletePresetBody = {};
  try {
    body = (await request.json()) as DeletePresetBody;
  } catch {
    body = {};
  }

  const presetId = typeof body.presetId === "string" ? body.presetId.trim() : "";
  if (!presetId) {
    return NextResponse.json({ error: "Silinecek hazır soru kimliği eksik." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("live_poll_presets")
      .delete()
      .eq("id", presetId);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      presetId,
      message: "Hazır soru silindi."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Hazır soru silinemedi.")
      },
      { status: 500 }
    );
  }
}
