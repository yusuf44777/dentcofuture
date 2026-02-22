"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "react-qr-code";
import {
  Activity,
  Bot,
  ChartColumnBig,
  Download,
  Hash,
  ListChecks,
  LoaderCircle,
  MessageSquareMore,
  Sparkles
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  type LivePollOption,
  LIVE_POLL_OPTIONS,
  LIVE_POLL_PROMPT,
  parsePollOption
} from "@/lib/engagement";
import type { AnalyticsRow, FeedbackRow, Json } from "@/lib/types";
import { Button } from "@/components/ui/button";

type Sentiment = {
  positive: number;
  neutral: number;
  negative: number;
};

type PollCounts = Record<LivePollOption, number>;
type AnalyzeUiState = "idle" | "loading" | "success" | "error";
type ModeratorBrief = {
  roomMood: string;
  audiencePriorities: string[];
  criticalQuestions: string[];
  recommendedActions: string[];
  confidence: number | null;
};

const DEFAULT_SENTIMENT: Sentiment = {
  positive: 34,
  neutral: 33,
  negative: 33
};
const EMPTY_MODERATOR_BRIEF: ModeratorBrief = {
  roomMood: "",
  audiencePriorities: [],
  criticalQuestions: [],
  recommendedActions: [],
  confidence: null
};

function createEmptyPollCounts(): PollCounts {
  return LIVE_POLL_OPTIONS.reduce((acc, option) => {
    acc[option] = 0;
    return acc;
  }, {} as PollCounts);
}

function toPercentage(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric * 10) / 10));
}

function parseSentiment(data: Json): Sentiment {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return DEFAULT_SENTIMENT;
  }

  const sentiment = {
    positive: toPercentage((data as Record<string, Json>).positive),
    neutral: toPercentage((data as Record<string, Json>).neutral),
    negative: toPercentage((data as Record<string, Json>).negative)
  };

  const total = sentiment.positive + sentiment.neutral + sentiment.negative;
  if (total === 0) {
    return DEFAULT_SENTIMENT;
  }

  if (total === 100) {
    return sentiment;
  }

  const scale = 100 / total;
  return {
    positive: Math.round(sentiment.positive * scale * 10) / 10,
    neutral: Math.round(sentiment.neutral * scale * 10) / 10,
    negative: Math.round(sentiment.negative * scale * 10) / 10
  };
}

function parseTopics(data: Json): {
  topics: string[];
  summary: string;
  moderatorBrief: ModeratorBrief;
} {
  if (Array.isArray(data)) {
    return {
      topics: data.filter((item): item is string => typeof item === "string").slice(0, 3),
      summary: "",
      moderatorBrief: EMPTY_MODERATOR_BRIEF
    };
  }

  if (!data || typeof data !== "object") {
    return {
      topics: [],
      summary: "",
      moderatorBrief: EMPTY_MODERATOR_BRIEF
    };
  }

  const payload = data as Record<string, Json>;
  const topTopics = payload.top_topics;
  const summaryRaw = payload.summary;
  const moderatorRaw =
    payload.moderator_brief && typeof payload.moderator_brief === "object" && !Array.isArray(payload.moderator_brief)
      ? (payload.moderator_brief as Record<string, Json>)
      : {};

  return {
    topics: Array.isArray(topTopics)
      ? topTopics.filter((item): item is string => typeof item === "string").slice(0, 3)
      : [],
    summary: typeof summaryRaw === "string" ? summaryRaw : "",
    moderatorBrief: {
      roomMood: typeof moderatorRaw.room_mood === "string" ? moderatorRaw.room_mood : "",
      audiencePriorities: Array.isArray(moderatorRaw.audience_priorities)
        ? moderatorRaw.audience_priorities
            .filter((item): item is string => typeof item === "string")
            .slice(0, 3)
        : [],
      criticalQuestions: Array.isArray(moderatorRaw.critical_questions)
        ? moderatorRaw.critical_questions
            .filter((item): item is string => typeof item === "string")
            .slice(0, 3)
        : [],
      recommendedActions: Array.isArray(moderatorRaw.recommended_actions)
        ? moderatorRaw.recommended_actions
            .filter((item): item is string => typeof item === "string")
            .slice(0, 3)
        : [],
      confidence:
        typeof moderatorRaw.confidence_0_100 === "number" && Number.isFinite(moderatorRaw.confidence_0_100)
          ? Math.round(moderatorRaw.confidence_0_100)
          : null
    }
  };
}

function getShortUrl(fullUrl: string) {
  try {
    const url = new URL(fullUrl);
    return `${url.host}/submit`;
  } catch {
    return "alanadiniz.com/submit";
  }
}

function getFilteredComments(rows: FeedbackRow[]) {
  return rows.filter((row) => !parsePollOption(row.message)).slice(0, 5);
}

function getPollCounts(rows: Array<Pick<FeedbackRow, "message">>) {
  const counts = createEmptyPollCounts();

  rows.forEach((row) => {
    const option = parsePollOption(row.message);
    if (option) {
      counts[option] += 1;
    }
  });

  return counts;
}

export function LiveDashboard() {
  const qrContainerRef = useRef<HTMLDivElement | null>(null);
  const [submitUrl, setSubmitUrl] = useState(
    process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/submit`
      : ""
  );
  const [totalResponses, setTotalResponses] = useState(0);
  const [sentiment, setSentiment] = useState<Sentiment>(DEFAULT_SENTIMENT);
  const [summary, setSummary] = useState("Analiz hazır olduğunda salonun genel duygu özeti burada görünecek.");
  const [topTopics, setTopTopics] = useState<string[]>([
    "Canlı veri bekleniyor",
    "Yapay zeka destekli diş hekimliği",
    "Hasta iletişimi"
  ]);
  const [latestComments, setLatestComments] = useState<FeedbackRow[]>([]);
  const [pollCounts, setPollCounts] = useState<PollCounts>(createEmptyPollCounts());
  const [moderatorBrief, setModeratorBrief] = useState<ModeratorBrief>(EMPTY_MODERATOR_BRIEF);
  const [analyzeUiState, setAnalyzeUiState] = useState<AnalyzeUiState>("idle");
  const [analyzeUiMessage, setAnalyzeUiMessage] = useState("");
  const [qrDownloadState, setQrDownloadState] = useState<"idle" | "loading" | "error">("idle");
  const [qrDownloadMessage, setQrDownloadMessage] = useState("");

  const barData = useMemo(
    () => [
      { name: "Olumlu", value: sentiment.positive, fill: "#2dd4bf" },
      { name: "Nötr", value: sentiment.neutral, fill: "#60a5fa" },
      { name: "Olumsuz", value: sentiment.negative, fill: "#f87171" }
    ],
    [sentiment]
  );

  const pollEntries = useMemo(
    () =>
      LIVE_POLL_OPTIONS.map((option) => ({
        option,
        count: pollCounts[option] ?? 0
      })),
    [pollCounts]
  );

  const pollTotal = useMemo(
    () => pollEntries.reduce((sum, item) => sum + item.count, 0),
    [pollEntries]
  );

  const shortUrl = useMemo(() => getShortUrl(submitUrl), [submitUrl]);

  useEffect(() => {
    if (!submitUrl && typeof window !== "undefined") {
      setSubmitUrl(`${window.location.origin}/submit`);
    }
  }, [submitUrl]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const applyAnalytics = (row: Pick<AnalyticsRow, "sentiment_score" | "top_keywords" | "total_feedbacks">) => {
      setSentiment(parseSentiment(row.sentiment_score));
      const parsedTopics = parseTopics(row.top_keywords);

      if (parsedTopics.topics.length > 0) {
        setTopTopics(parsedTopics.topics);
      }

      if (parsedTopics.summary) {
        setSummary(parsedTopics.summary);
      }

      setModeratorBrief(parsedTopics.moderatorBrief);

      if (typeof row.total_feedbacks === "number") {
        setTotalResponses(row.total_feedbacks);
      }
    };

    const loadInitialData = async () => {
      const [countResult, feedbackResult, analyticsResult] = await Promise.all([
        supabase.from("attendee_feedbacks").select("id", { count: "exact", head: true }),
        supabase
          .from("attendee_feedbacks")
          .select("id, message, created_at, is_analyzed")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("congress_analytics")
          .select("total_feedbacks, sentiment_score, top_keywords")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (!countResult.error) {
        setTotalResponses(countResult.count ?? 0);
      }

      if (!feedbackResult.error) {
        const rows = feedbackResult.data ?? [];
        setLatestComments(getFilteredComments(rows));
        setPollCounts(getPollCounts(rows));
      }

      if (!analyticsResult.error && analyticsResult.data) {
        applyAnalytics(analyticsResult.data);
      }
    };

    void loadInitialData();

    const feedbackChannel = supabase
      .channel("feedback-stream")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendee_feedbacks"
        },
        (payload) => {
          const row = payload.new as FeedbackRow;
          setTotalResponses((prev) => prev + 1);

          const pollOption = parsePollOption(row.message);
          if (pollOption) {
            setPollCounts((prev) => ({
              ...prev,
              [pollOption]: (prev[pollOption] ?? 0) + 1
            }));
            return;
          }

          setLatestComments((prev) => [row, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    const analyticsChannel = supabase
      .channel("analytics-stream")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "congress_analytics"
        },
        (payload) => {
          applyAnalytics(payload.new as AnalyticsRow);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(feedbackChannel);
      void supabase.removeChannel(analyticsChannel);
    };
  }, []);

  const handleRunAnalyze = async () => {
    if (analyzeUiState === "loading") {
      return;
    }

    setAnalyzeUiState("loading");
    setAnalyzeUiMessage("");

    try {
      const response = await fetch("/api/analyze?force=true", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        }
      });

      const data = (await response.json().catch(() => null)) as
        | {
            processed?: number;
            processed_text_rows?: number;
            processed_poll_rows?: number;
            skipped?: boolean;
            reason?: string;
            error?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Analiz tetiklenirken bir hata oluştu.");
      }

      if (data?.skipped) {
        setAnalyzeUiState("success");
        setAnalyzeUiMessage(data.reason ?? "Analiz çalıştırıldı, yeni veri bekleniyor.");
        return;
      }

      setAnalyzeUiState("success");
      setAnalyzeUiMessage(
        `Analiz tamamlandı. İşlenen metin: ${data?.processed_text_rows ?? 0}, anket: ${
          data?.processed_poll_rows ?? 0
        }.`
      );
    } catch (error) {
      setAnalyzeUiState("error");
      setAnalyzeUiMessage(error instanceof Error ? error.message : "Analiz tetiklenirken bir hata oluştu.");
    }
  };

  const handleDownloadQr = () => {
    if (qrDownloadState === "loading") {
      return;
    }

    setQrDownloadState("loading");
    setQrDownloadMessage("");

    try {
      const svgElement = qrContainerRef.current?.querySelector("svg");
      if (!svgElement) {
        throw new Error("QR kod bulunamadı.");
      }

      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clonedSvg.setAttribute("width", "1024");
      clonedSvg.setAttribute("height", "1024");

      const serialized = new XMLSerializer().serializeToString(clonedSvg);
      const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = "dentcofuture-qr.svg";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      URL.revokeObjectURL(blobUrl);
      setQrDownloadState("idle");
      setQrDownloadMessage("QR kod indirildi.");
    } catch (error) {
      setQrDownloadState("error");
      setQrDownloadMessage(error instanceof Error ? error.message : "QR kod indirilemedi.");
    }
  };

  return (
    <main className="dashboard-surface subtle-grid min-h-screen px-4 py-4 text-slate-100 md:px-8 md:py-6">
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6">
        <header className="glass-panel rounded-2xl px-5 py-5 md:px-8 md:py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="https://i.imgur.com/Q3ASL2i.png"
                alt="Dent Co Future logosu"
                width={220}
                height={88}
                className="h-auto w-[150px] md:w-[210px]"
                priority
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                  Canlı Etkileşim Panosu
                </p>
                <h1 className="text-xl font-semibold tracking-tight md:text-3xl">Dent Co Future</h1>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200/80">
                  COMMUNITIVE DENTISTRY
                </p>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-slate-300">
              28 Şubat 2026, Nâzım Hikmet Kültür Merkezi etkinliğinden gelen salon geri bildirimleri gerçek
              zamanlı olarak toplanır, yapay zeka ile analiz edilir ve anında güncellenir.
            </p>
          </div>
        </header>

        <section className="grid items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="glass-panel rounded-3xl p-6 xl:sticky xl:top-6">
            <div className="mb-5 flex items-center gap-2 text-cyan-200">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Anında Katılım</h2>
            </div>
            <p className="mb-6 text-sm text-slate-300">
              Katılımcılar QR kodu okutarak birkaç saniye içinde geri bildirim formuna ulaşabilir.
            </p>

            <div
              ref={qrContainerRef}
              className="mx-auto w-fit rounded-3xl bg-white p-5 shadow-2xl shadow-cyan-300/15"
            >
              <QRCode
                value={submitUrl || "https://example.com/submit"}
                size={280}
                fgColor="#0f172a"
                bgColor="#ffffff"
              />
            </div>

            <p className="mt-6 text-center text-sm uppercase tracking-[0.18em] text-cyan-100/70">Kısa URL</p>
            <p className="mt-2 text-center text-2xl font-semibold tracking-tight text-cyan-100">{shortUrl}</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-cyan-200/30 bg-cyan-200/10 text-cyan-50 hover:bg-cyan-200/20"
                onClick={handleDownloadQr}
                disabled={qrDownloadState === "loading"}
              >
                <Download className="h-4 w-4" />
                {qrDownloadState === "loading" ? "Hazırlanıyor..." : "Karekodu İndir"}
              </Button>
              {qrDownloadMessage ? (
                <p
                  className={`text-xs ${
                    qrDownloadState === "error" ? "text-rose-300" : "text-cyan-100/80"
                  }`}
                >
                  {qrDownloadMessage}
                </p>
              ) : null}
            </div>
          </aside>

          <section className="grid gap-6 md:grid-cols-2">
            <article className="glass-panel rounded-3xl p-5 md:col-span-2 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-slate-300">
                    <Activity className="h-4 w-4 text-cyan-300" />
                    Toplam Yanıt
                  </p>
                  <p className="mt-2 text-4xl font-semibold text-white md:text-6xl">{totalResponses}</p>
                </div>
                <div className="w-full max-w-2xl space-y-3">
                  <div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/5 px-4 py-3">
                    <p className="text-sm text-cyan-50">{summary}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      onClick={handleRunAnalyze}
                      disabled={analyzeUiState === "loading"}
                      className="h-10 px-4"
                    >
                      {analyzeUiState === "loading" ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          AI Analizi Çalışıyor...
                        </>
                      ) : (
                        <>
                          <Bot className="h-4 w-4" />
                          AI Analizini Yenile
                        </>
                      )}
                    </Button>
                    {analyzeUiMessage ? (
                      <p
                        className={`text-xs font-medium ${
                          analyzeUiState === "error" ? "text-rose-300" : "text-cyan-100"
                        }`}
                      >
                        {analyzeUiMessage}
                      </p>
                    ) : (
                      <p className="text-xs text-cyan-200/75">
                        Moderatörler için güncel içgörü oluşturmak üzere istediğiniz an manuel tetikleyin.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </article>

            <article className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <ChartColumnBig className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Duygu Dağılımı</h3>
              </div>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ left: 6, right: 6, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
                    <XAxis dataKey="name" tick={{ fill: "#e2e8f0", fontSize: 12 }} axisLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "#e2e8f0", fontSize: 12 }}
                      axisLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(148,163,184,0.15)" }}
                      contentStyle={{
                        backgroundColor: "#081731",
                        border: "1px solid rgba(186,230,253,0.3)",
                        borderRadius: "12px",
                        color: "#f8fafc"
                      }}
                      formatter={(value) => `${value}%`}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <ListChecks className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Canlı Anket Sonuçları</h3>
              </div>
              <p className="mb-3 text-sm text-slate-300">{LIVE_POLL_PROMPT}</p>
              <div className="space-y-3">
                {pollEntries.map((entry) => {
                  const percent = pollTotal > 0 ? Math.round((entry.count / pollTotal) * 100) : 0;

                  return (
                    <div key={entry.option} className="rounded-xl border border-cyan-200/15 bg-cyan-200/5 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <p className="font-medium text-white">{entry.option}</p>
                        <p className="font-semibold text-cyan-100">
                          {entry.count} <span className="text-cyan-200/70">({percent}%)</span>
                        </p>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800/80">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-cyan-200/80">
                Toplam anket yanıtı: {pollTotal}
              </p>
            </article>

            <article className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <Hash className="h-5 w-5" />
                <h3 className="text-lg font-semibold">En Çok Konuşulan 3 Konu</h3>
              </div>
              <ul className="space-y-3">
                {topTopics.slice(0, 3).map((topic, index) => (
                  <li
                    key={`${topic}-${index}`}
                    className="animate-fade-in-up rounded-xl border border-cyan-200/15 bg-cyan-200/5 px-4 py-3 text-sm text-slate-100"
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <span className="text-xs uppercase tracking-wider text-cyan-200/70">Konu {index + 1}</span>
                    <p className="mt-1 text-base font-medium text-white">{topic}</p>
                  </li>
                ))}
              </ul>
            </article>

            <article className="glass-panel rounded-3xl p-5 md:col-span-2 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <Bot className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Moderatör İçgörüleri</h3>
              </div>

              <div className="mb-4 rounded-xl border border-cyan-200/20 bg-cyan-300/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">Salon Modu</p>
                <p className="mt-1 text-sm font-medium text-white">
                  {moderatorBrief.roomMood || "AI analizi sonrası salon modu burada görünecek."}
                </p>
                <p className="mt-2 text-xs text-cyan-200/75">
                  Güven skoru:{" "}
                  {typeof moderatorBrief.confidence === "number" ? `%${moderatorBrief.confidence}` : "Henüz yok"}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-cyan-200/15 bg-cyan-200/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
                    Öncelikli Beklentiler
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-100">
                    {(moderatorBrief.audiencePriorities.length > 0
                      ? moderatorBrief.audiencePriorities
                      : ["Yeni analiz bekleniyor."]).map((item, index) => (
                      <li key={`priority-${item}-${index}`}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-cyan-200/15 bg-cyan-200/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
                    Kritik Sorular
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-100">
                    {(moderatorBrief.criticalQuestions.length > 0
                      ? moderatorBrief.criticalQuestions
                      : ["Yeni analiz bekleniyor."]).map((item, index) => (
                      <li key={`critical-${item}-${index}`}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-cyan-200/15 bg-cyan-200/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
                    Önerilen Aksiyonlar
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-100">
                    {(moderatorBrief.recommendedActions.length > 0
                      ? moderatorBrief.recommendedActions
                      : ["Yeni analiz bekleniyor."]).map((item, index) => (
                      <li key={`action-${item}-${index}`}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>

            <article className="glass-panel rounded-3xl p-5 md:col-span-2 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <MessageSquareMore className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Son Serbest Yorumlar</h3>
              </div>

              <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
                {latestComments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-cyan-100/20 px-4 py-8 text-center text-sm text-slate-400">
                    Serbest yorum bekleniyor...
                  </div>
                ) : (
                  latestComments.map((comment, index) => (
                    <article
                      key={comment.id}
                      className="animate-fade-in-up rounded-xl border border-cyan-100/15 bg-slate-900/30 px-4 py-3"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
                        Anonim Katılımcı
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-100">{comment.message}</p>
                    </article>
                  ))
                )}
              </div>
            </article>
          </section>
        </section>
      </div>
    </main>
  );
}
