import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gpt-4o-mini";
const MIN_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;

const SYSTEM_PROMPT =
  "Communitive Dentistry İstanbul tarafından düzenlenen Dent Co Future etkinliği için uzman bir veri analistisiniz. Aşağıdaki katılımcı geri bildirimlerini analiz edin. YALNIZCA şu alanları içeren bir JSON döndürün: 1. 'sentiment': olumlu, olumsuz ve nötr yüzdeleri içeren nesne. 2. 'top_topics': en çok konuşulan 3 temayı içeren dizi. 3. 'summary': genel atmosferi anlatan tek cümlelik özet. Sonuç metinlerini Türkçe üretin.";

function getAnalyzeSecret() {
  return process.env.CRON_SECRET ?? process.env.ANALYZE_API_SECRET ?? "";
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return "";
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

function isAnalyzeAuthorized(request: NextRequest) {
  const secret = getAnalyzeSecret();

  // Local development convenience: allow requests when no secret is configured.
  if (!secret && process.env.NODE_ENV !== "production") {
    return true;
  }

  if (!secret) {
    return false;
  }

  const bearerToken = getBearerToken(request);
  const headerSecret = request.headers.get("x-analyze-secret")?.trim() ?? "";

  return bearerToken === secret || headerSecret === secret;
}

function isAnalyzeSecretRequiredButMissing() {
  return process.env.NODE_ENV === "production" && !getAnalyzeSecret();
}

function getErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Analiz işlemi sırasında bir hata oluştu.";
  }

  return error instanceof Error ? error.message : "Beklenmeyen analiz hatası";
}

function toPercent(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric * 10) / 10));
}

function normalizeSentiment(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      positive: 0,
      neutral: 100,
      negative: 0
    };
  }

  const raw = value as Record<string, unknown>;
  const normalized = {
    positive: toPercent(raw.positive),
    neutral: toPercent(raw.neutral),
    negative: toPercent(raw.negative)
  };

  const total = normalized.positive + normalized.neutral + normalized.negative;
  if (total === 0) {
    return {
      positive: 0,
      neutral: 100,
      negative: 0
    };
  }

  if (total === 100) {
    return normalized;
  }

  const scale = 100 / total;
  return {
    positive: Math.round(normalized.positive * scale * 10) / 10,
    neutral: Math.round(normalized.neutral * scale * 10) / 10,
    negative: Math.round(normalized.negative * scale * 10) / 10
  };
}

async function shouldForceRun(request: NextRequest) {
  const url = new URL(request.url);
  const byQuery = url.searchParams.get("force") === "true";

  let byBody = false;
  try {
    const body = (await request.json()) as { force?: boolean };
    byBody = body.force === true;
  } catch {
    byBody = false;
  }

  return byQuery || byBody;
}

async function runBatch(force: boolean) {
  const supabase = createSupabaseAdminClient();

  const { data: pendingRows, error: pendingError } = await supabase
    .from("attendee_feedbacks")
    .select("id, message, created_at")
    .eq("is_analyzed", false)
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH_SIZE);

  if (pendingError) {
    throw new Error(`Bekleyen geri bildirimler alınamadı: ${pendingError.message}`);
  }

  const pending = pendingRows ?? [];

  if (pending.length === 0) {
    return {
      processed: 0,
      skipped: true,
      reason: "Bekleyen geri bildirim kaydı yok."
    };
  }

  if (pending.length < MIN_BATCH_SIZE && !force) {
    return {
      processed: 0,
      skipped: true,
      reason: `Bekleyen kayıt sayısı eşik altında (${pending.length}/${MIN_BATCH_SIZE}).`
    };
  }

  const combinedFeedback = pending
    .map((item, index) => `${index + 1}. ${item.message.replace(/\s+/g, " ").trim()}`)
    .join("\n");

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY ortam değişkeni eksik.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "user",
        content: `Geri bildirim kümesi:\n${combinedFeedback}`
      }
    ]
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI boş bir yanıt döndürdü.");
  }

  let parsed: {
    sentiment?: unknown;
    top_topics?: unknown;
    summary?: unknown;
  };

  try {
    parsed = JSON.parse(content) as {
      sentiment?: unknown;
      top_topics?: unknown;
      summary?: unknown;
    };
  } catch {
    throw new Error("Model çıktısı JSON olarak ayrıştırılamadı.");
  }

  const sentiment = normalizeSentiment(parsed.sentiment);
  const topTopics = Array.isArray(parsed.top_topics)
    ? parsed.top_topics.filter((item): item is string => typeof item === "string").slice(0, 3)
    : [];
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";

  const { count: totalCount, error: countError } = await supabase
    .from("attendee_feedbacks")
    .select("id", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Geri bildirim sayısı alınamadı: ${countError.message}`);
  }

  const analyticsPayload: {
    total_feedbacks: number;
    sentiment_score: Json;
    top_keywords: Json;
  } = {
    total_feedbacks: totalCount ?? 0,
    sentiment_score: sentiment,
    top_keywords: {
      top_topics: topTopics,
      summary
    }
  };

  const { error: analyticsError } = await supabase
    .from("congress_analytics")
    .insert(analyticsPayload);

  if (analyticsError) {
    throw new Error(`Analitik kaydı eklenemedi: ${analyticsError.message}`);
  }

  const processedIds = pending.map((item) => item.id);

  const { error: markError } = await supabase
    .from("attendee_feedbacks")
    .update({ is_analyzed: true })
    .in("id", processedIds);

  if (markError) {
    throw new Error(`Geri bildirim kayıtları analiz edildi olarak işaretlenemedi: ${markError.message}`);
  }

  return {
    processed: processedIds.length,
    skipped: false,
    sentiment,
    top_topics: topTopics,
    summary
  };
}

export async function POST(request: NextRequest) {
  if (isAnalyzeSecretRequiredButMissing()) {
    return NextResponse.json(
      {
        error: "Güvenlik yapılandırması eksik: CRON_SECRET veya ANALYZE_API_SECRET tanımlanmalı."
      },
      { status: 500 }
    );
  }

  if (!isAnalyzeAuthorized(request)) {
    return NextResponse.json(
      {
        error: "Yetkisiz erişim."
      },
      { status: 401 }
    );
  }

  try {
    const force = await shouldForceRun(request);
    const result = await runBatch(force);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (isAnalyzeSecretRequiredButMissing()) {
    return NextResponse.json(
      {
        error: "Güvenlik yapılandırması eksik: CRON_SECRET veya ANALYZE_API_SECRET tanımlanmalı."
      },
      { status: 500 }
    );
  }

  if (!isAnalyzeAuthorized(request)) {
    return NextResponse.json(
      {
        error: "Yetkisiz erişim."
      },
      { status: 401 }
    );
  }

  try {
    const force = new URL(request.url).searchParams.get("force") === "true";
    const result = await runBatch(force);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
