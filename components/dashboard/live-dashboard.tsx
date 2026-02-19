"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "react-qr-code";
import {
  Activity,
  ChartColumnBig,
  Hash,
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
import type { AnalyticsRow, FeedbackRow, Json } from "@/lib/types";

type Sentiment = {
  positive: number;
  neutral: number;
  negative: number;
};

const DEFAULT_SENTIMENT: Sentiment = {
  positive: 34,
  neutral: 33,
  negative: 33
};

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

function parseTopics(data: Json): { topics: string[]; summary: string } {
  if (Array.isArray(data)) {
    return {
      topics: data.filter((item): item is string => typeof item === "string").slice(0, 3),
      summary: ""
    };
  }

  if (!data || typeof data !== "object") {
    return {
      topics: [],
      summary: ""
    };
  }

  const topTopics = (data as Record<string, Json>).top_topics;
  const summaryRaw = (data as Record<string, Json>).summary;

  return {
    topics: Array.isArray(topTopics)
      ? topTopics.filter((item): item is string => typeof item === "string").slice(0, 3)
      : [],
    summary: typeof summaryRaw === "string" ? summaryRaw : ""
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

export function LiveDashboard() {
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

  const barData = useMemo(
    () => [
      { name: "Olumlu", value: sentiment.positive, fill: "#2dd4bf" },
      { name: "Nötr", value: sentiment.neutral, fill: "#60a5fa" },
      { name: "Olumsuz", value: sentiment.negative, fill: "#f87171" }
    ],
    [sentiment]
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

      if (typeof row.total_feedbacks === "number") {
        setTotalResponses(row.total_feedbacks);
      }
    };

    const loadInitialData = async () => {
      const [countResult, commentsResult, analyticsResult] = await Promise.all([
        supabase.from("attendee_feedbacks").select("id", { count: "exact", head: true }),
        supabase
          .from("attendee_feedbacks")
          .select("id, message, created_at, is_analyzed")
          .order("created_at", { ascending: false })
          .limit(5),
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

      if (!commentsResult.error) {
        setLatestComments(commentsResult.data ?? []);
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

  return (
    <main className="dashboard-surface subtle-grid min-h-screen px-4 py-4 text-slate-100 md:px-8 md:py-6">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
        <header className="glass-panel flex flex-col justify-between gap-3 rounded-2xl px-5 py-4 md:flex-row md:items-center md:px-8">
          <div className="flex items-center gap-4">
            <Image
              src="https://i.imgur.com/Q3ASL2i.png"
              alt="Dent Co Future logosu"
              width={200}
              height={80}
              className="h-auto w-[140px] md:w-[190px]"
              priority
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Canlı Etkileşim Panosu
              </p>
              <h1 className="text-xl font-semibold tracking-tight md:text-3xl">
                Dent Co Future
              </h1>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200/80">
                Communitive Dentistry İstanbul
              </p>
            </div>
          </div>
          <p className="max-w-xl text-sm text-slate-300">
            28 Şubat 2026, Nâzım Hikmet Kültür Merkezi etkinliğinden gelen salon geri bildirimleri gerçek
            zamanlı olarak toplanır, yapay zeka ile analiz edilir ve anında güncellenir.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-12">
          <article className="glass-panel rounded-3xl p-5 lg:col-span-4 lg:p-8">
            <div className="mb-5 flex items-center gap-2 text-cyan-200">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Anında Katılım</h2>
            </div>
            <p className="mb-6 text-sm text-slate-300">
              Katılımcılar telefonlarından QR kodu okutup doğrudan geri bildirim ekranına ulaşabilir.
            </p>

            <div className="mx-auto w-fit rounded-3xl bg-white p-5 shadow-2xl shadow-cyan-300/15">
              <QRCode
                value={submitUrl || "https://example.com/submit"}
                size={260}
                fgColor="#0f172a"
                bgColor="#ffffff"
              />
            </div>

            <p className="mt-6 text-center text-sm uppercase tracking-[0.18em] text-cyan-100/70">Kısa URL</p>
            <p className="mt-2 text-center text-2xl font-semibold tracking-tight text-cyan-100 md:text-4xl">
              {shortUrl}
            </p>
          </article>

          <section className="grid gap-6 lg:col-span-8 md:grid-cols-2">
            <article className="glass-panel rounded-3xl p-5 md:col-span-2 md:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-slate-300">
                    <Activity className="h-4 w-4 text-cyan-300" />
                    Toplam Yanıt
                  </p>
                  <p className="mt-2 text-4xl font-semibold text-white md:text-6xl">{totalResponses}</p>
                </div>
                <div className="max-w-md rounded-2xl border border-cyan-200/20 bg-cyan-300/5 px-4 py-3">
                  <p className="text-sm text-cyan-50">{summary}</p>
                </div>
              </div>
            </article>

            <article className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <ChartColumnBig className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Duygu Dağılımı</h3>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
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
                <MessageSquareMore className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Son Yorumlar</h3>
              </div>

              <div className="grid gap-3">
                {latestComments.length === 0 && (
                  <div className="rounded-xl border border-dashed border-cyan-100/20 px-4 py-8 text-center text-sm text-slate-400">
                    İlk yorum bekleniyor...
                  </div>
                )}

                {latestComments.map((comment, index) => (
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
                ))}
              </div>
            </article>
          </section>
        </section>
      </div>
    </main>
  );
}
