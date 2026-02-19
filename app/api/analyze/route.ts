import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  DASHBOARD_AUTH_COOKIE_NAME,
  isDashboardSessionValid
} from "@/lib/auth/dashboard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isPollMessage } from "@/lib/engagement";
import type { Json } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gpt-5-mini-2025-08-07";
const MIN_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;

const SYSTEM_PROMPT =
  [
    "Communitive Dentistry İstanbul tarafından düzenlenen Dent Co Future etkinliği için kıdemli veri analisti olarak çalışıyorsun.",
    "Senden beklenen: moderatörün sahnede hızlı ve doğru karar almasını sağlayacak net içgörü üretmek.",
    "YALNIZCA geçerli JSON döndür, markdown veya açıklama metni yazma.",
    "Dil: Türkçe.",
    "JSON şeması:",
    "{",
    "  \"sentiment\": { \"positive\": number, \"neutral\": number, \"negative\": number },",
    "  \"top_topics\": [string, string, string],",
    "  \"summary\": string,",
    "  \"moderator_brief\": {",
    "    \"room_mood\": string,",
    "    \"audience_priorities\": [string, string, string],",
    "    \"critical_questions\": [string, string, string],",
    "    \"recommended_actions\": [string, string, string],",
    "    \"confidence_0_100\": number",
    "  }",
    "}",
    "Kurallar:",
    "- sentiment yüzdeleri 0-100 aralığında olsun ve toplamları yaklaşık 100 olsun.",
    "- top_topics en çok konuşulan 3 temayı kısa ve net ifade etsin.",
    "- summary tek cümle ve moderasyon açısından eyleme dönük olsun.",
    "- moderator_brief maddeleri tekrar etmeyen, uygulanabilir ve kısa ifadelerden oluşsun.",
    "- Yetersiz veri varsa bunu summary ve moderator_brief içinde açıkça belirt."
  ].join("\n");

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

function isAnalyzeSecretAuthorized(request: NextRequest) {
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

function isDashboardModeratorAuthorized(request: NextRequest) {
  const sessionToken = request.cookies.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;
  return isDashboardSessionValid(sessionToken);
}

function isAnalyzeAuthorized(request: NextRequest) {
  if (isAnalyzeSecretAuthorized(request)) {
    return true;
  }

  return isDashboardModeratorAuthorized(request);
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

function clampNumber(value: unknown, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }

  return Math.max(min, Math.min(max, numeric));
}

function toStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
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

  const pollRows = pending.filter((row) => isPollMessage(row.message));
  const textRows = pending.filter((row) => !isPollMessage(row.message) && row.message.trim().length > 0);

  const markRowsAnalyzed = async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    const { error } = await supabase
      .from("attendee_feedbacks")
      .update({ is_analyzed: true })
      .in("id", ids);

    if (error) {
      throw new Error(`Geri bildirim kayıtları analiz edildi olarak işaretlenemedi: ${error.message}`);
    }
  };

  if (textRows.length === 0) {
    await markRowsAnalyzed(pollRows.map((row) => row.id));

    return {
      processed: pollRows.length,
      skipped: true,
      reason: "Sadece anket yanıtları bulundu; metin analizi için serbest geri bildirim bekleniyor."
    };
  }

  if (textRows.length < MIN_BATCH_SIZE && !force) {
    await markRowsAnalyzed(pollRows.map((row) => row.id));

    return {
      processed: pollRows.length,
      skipped: true,
      reason: `Serbest metin yanıtları eşik altında (${textRows.length}/${MIN_BATCH_SIZE}).`
    };
  }

  const combinedFeedback = textRows
    .map((item, index) => `${index + 1}. ${item.message.replace(/\s+/g, " ").trim()}`)
    .join("\n");

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY ortam değişkeni eksik.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
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
    moderator_brief?: unknown;
  };

  try {
    parsed = JSON.parse(content) as {
      sentiment?: unknown;
      top_topics?: unknown;
      summary?: unknown;
      moderator_brief?: unknown;
    };
  } catch {
    throw new Error("Model çıktısı JSON olarak ayrıştırılamadı.");
  }

  const sentiment = normalizeSentiment(parsed.sentiment);
  const topTopics = toStringArray(parsed.top_topics, 3);
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const moderatorBriefRaw =
    parsed.moderator_brief && typeof parsed.moderator_brief === "object"
      ? (parsed.moderator_brief as Record<string, unknown>)
      : {};
  const moderatorBrief = {
    room_mood:
      typeof moderatorBriefRaw.room_mood === "string" ? moderatorBriefRaw.room_mood.trim() : "",
    audience_priorities: toStringArray(moderatorBriefRaw.audience_priorities, 3),
    critical_questions: toStringArray(moderatorBriefRaw.critical_questions, 3),
    recommended_actions: toStringArray(moderatorBriefRaw.recommended_actions, 3),
    confidence_0_100: Math.round(clampNumber(moderatorBriefRaw.confidence_0_100, 0, 100))
  };

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
      summary,
      moderator_brief: moderatorBrief
    }
  };

  const { error: analyticsError } = await supabase
    .from("congress_analytics")
    .insert(analyticsPayload);

  if (analyticsError) {
    throw new Error(`Analitik kaydı eklenemedi: ${analyticsError.message}`);
  }

  const processedIds = [...textRows.map((item) => item.id), ...pollRows.map((item) => item.id)];
  await markRowsAnalyzed(processedIds);

  return {
    processed: processedIds.length,
    processed_text_rows: textRows.length,
    processed_poll_rows: pollRows.length,
    skipped: false,
    sentiment,
    top_topics: topTopics,
    summary,
    moderator_brief: moderatorBrief
  };
}

export async function POST(request: NextRequest) {
  const moderatorAuthorized = isDashboardModeratorAuthorized(request);

  if (isAnalyzeSecretRequiredButMissing() && !moderatorAuthorized) {
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
  const moderatorAuthorized = isDashboardModeratorAuthorized(request);

  if (isAnalyzeSecretRequiredButMissing() && !moderatorAuthorized) {
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
