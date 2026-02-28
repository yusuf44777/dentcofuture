"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "react-qr-code";
import {
  Activity,
  Bot,
  ChartColumnBig,
  Download,
  Gift,
  Hash,
  ListChecks,
  LoaderCircle,
  MessageSquareMore,
  RotateCcw,
  Trash2,
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
  type LivePollConfig,
  type LivePollPresetConfig,
  LIVE_POLL_OPTIONS,
  LIVE_POLL_PROMPT,
  parsePollResponse
} from "@/lib/engagement";
import type { AnalyticsRow, FeedbackRow, Json } from "@/lib/types";
import { Button } from "@/components/ui/button";

type Sentiment = {
  positive: number;
  neutral: number;
  negative: number;
};

type PollCounts = Record<string, number>;
type AnalyzeUiState = "idle" | "loading" | "success" | "error";
type HardResetUiState = "idle" | "loading" | "success" | "error";
type PollControlUiState = "idle" | "loading" | "success" | "error";
type ModeratorBrief = {
  roomMood: string;
  audiencePriorities: string[];
  criticalQuestions: string[];
  recommendedActions: string[];
  confidence: number | null;
};
type LivePollApiResponse = {
  ok?: boolean;
  activePoll?: LivePollConfig | null;
  message?: string;
  error?: string;
};
type LivePollPresetApiResponse = {
  ok?: boolean;
  presets?: LivePollPresetConfig[];
  preset?: LivePollPresetConfig | null;
  presetId?: string;
  message?: string;
  error?: string;
};

const SUBMIT_TARGET_URL = "https://dentcofuture.vercel.app/submit";
const DASHBOARD_RESET_CURSOR_STORAGE_KEY = "dentco_dashboard_reset_cursor";
const DEFAULT_SUMMARY = "Analiz hazır olduğunda salonun genel duygu özeti burada görünecek.";
const RESET_SUMMARY = "Sıfırlama sonrası yeni geri bildirimler bekleniyor.";
const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 10;
const POLL_QUESTION_MAX_CHARS = 180;
const POLL_OPTION_MAX_CHARS = 80;
const DEFAULT_TOPICS = [
  "Canlı veri bekleniyor",
  "Yapay zeka destekli diş hekimliği",
  "Hasta iletişimi"
];

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

function createEmptyPollCounts(options: string[]): PollCounts {
  return options.reduce((acc, option) => {
    acc[option] = 0;
    return acc;
  }, {} as PollCounts);
}

function getActivePollOptions(activePoll: LivePollConfig | null) {
  if (activePoll && Array.isArray(activePoll.options) && activePoll.options.length >= MIN_POLL_OPTIONS) {
    return activePoll.options;
  }

  return [...LIVE_POLL_OPTIONS];
}

function getActivePollPrompt(activePoll: LivePollConfig | null) {
  return activePoll?.question ?? LIVE_POLL_PROMPT;
}

function normalizePollDraftText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizePollDraftOptions(options: string[]) {
  const dedupe = new Set<string>();
  const sanitized: string[] = [];

  for (const option of options) {
    const normalized = normalizePollDraftText(option, POLL_OPTION_MAX_CHARS);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLocaleLowerCase("tr-TR");
    if (dedupe.has(key)) {
      continue;
    }

    dedupe.add(key);
    sanitized.push(normalized);
  }

  return sanitized.slice(0, MAX_POLL_OPTIONS);
}

function isSameActivePoll(a: LivePollConfig | null, b: LivePollConfig | null) {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (a.id !== b.id || a.updatedAt !== b.updatedAt || a.question !== b.question) {
    return false;
  }
  if (a.options.length !== b.options.length) {
    return false;
  }

  return a.options.every((option, index) => option === b.options[index]);
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
  return rows.filter((row) => !parsePollResponse(row.message)).slice(0, 5);
}

function getPollCounts(rows: Array<Pick<FeedbackRow, "message">>, activePoll: LivePollConfig | null) {
  const options = getActivePollOptions(activePoll);
  const counts = createEmptyPollCounts(options);
  const allowedOptions = new Set(options);

  rows.forEach((row) => {
    const response = parsePollResponse(row.message);
    if (!response) {
      return;
    }

    if (activePoll?.id) {
      if (response.pollId !== activePoll.id) {
        return;
      }
    } else if (response.pollId) {
      return;
    }

    if (!allowedOptions.has(response.option)) {
      return;
    }

    counts[response.option] += 1;
  });

  return counts;
}

function isAfterResetCursor(createdAt: string, resetCursor: string | null) {
  if (!resetCursor) {
    return true;
  }

  const createdAtMs = new Date(createdAt).getTime();
  const cursorMs = new Date(resetCursor).getTime();
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(cursorMs)) {
    return true;
  }

  return createdAtMs >= cursorMs;
}

function formatResetCursor(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export function LiveDashboard() {
  const qrContainerRef = useRef<HTMLDivElement | null>(null);
  const [submitUrl] = useState(SUBMIT_TARGET_URL);
  const [totalResponses, setTotalResponses] = useState(0);
  const [sentiment, setSentiment] = useState<Sentiment>(DEFAULT_SENTIMENT);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [topTopics, setTopTopics] = useState<string[]>(DEFAULT_TOPICS);
  const [latestComments, setLatestComments] = useState<FeedbackRow[]>([]);
  const [activePoll, setActivePoll] = useState<LivePollConfig | null>(null);
  const [pollCounts, setPollCounts] = useState<PollCounts>(() =>
    createEmptyPollCounts([...LIVE_POLL_OPTIONS])
  );
  const [moderatorBrief, setModeratorBrief] = useState<ModeratorBrief>(EMPTY_MODERATOR_BRIEF);
  const [analyzeUiState, setAnalyzeUiState] = useState<AnalyzeUiState>("idle");
  const [analyzeUiMessage, setAnalyzeUiMessage] = useState("");
  const [hardResetUiState, setHardResetUiState] = useState<HardResetUiState>("idle");
  const [hardResetUiMessage, setHardResetUiMessage] = useState("");
  const [qrDownloadState, setQrDownloadState] = useState<"idle" | "loading" | "error">("idle");
  const [qrDownloadMessage, setQrDownloadMessage] = useState("");
  const [resetCursor, setResetCursor] = useState<string | null>(null);
  const [resetCursorLoaded, setResetCursorLoaded] = useState(false);
  const [resetUiMessage, setResetUiMessage] = useState("");
  const [pollConfigUiState, setPollConfigUiState] = useState<"loading" | "ready" | "error">("loading");
  const [pollConfigUiMessage, setPollConfigUiMessage] = useState("");
  const [pollPublishUiState, setPollPublishUiState] = useState<PollControlUiState>("idle");
  const [pollPublishUiMessage, setPollPublishUiMessage] = useState("");
  const [pollCloseUiState, setPollCloseUiState] = useState<PollControlUiState>("idle");
  const [pollCloseUiMessage, setPollCloseUiMessage] = useState("");
  const [pollQuestionDraft, setPollQuestionDraft] = useState("");
  const [pollOptionDrafts, setPollOptionDrafts] = useState(["", "", "", ""]);
  const [pollPresets, setPollPresets] = useState<LivePollPresetConfig[]>([]);
  const [pollPresetUiState, setPollPresetUiState] = useState<"loading" | "ready" | "error">("loading");
  const [pollPresetUiMessage, setPollPresetUiMessage] = useState("");
  const [presetSaveUiState, setPresetSaveUiState] = useState<PollControlUiState>("idle");
  const [presetSaveUiMessage, setPresetSaveUiMessage] = useState("");
  const [presetDeletingId, setPresetDeletingId] = useState("");
  const [presetLaunchingId, setPresetLaunchingId] = useState("");

  const activePollOptions = useMemo(() => getActivePollOptions(activePoll), [activePoll]);
  const activePollPrompt = useMemo(() => getActivePollPrompt(activePoll), [activePoll]);

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
      activePollOptions.map((option) => ({
        option,
        count: pollCounts[option] ?? 0
      })),
    [activePollOptions, pollCounts]
  );

  const pollTotal = useMemo(
    () => pollEntries.reduce((sum, item) => sum + item.count, 0),
    [pollEntries]
  );

  const shortUrl = useMemo(() => getShortUrl(submitUrl), [submitUrl]);
  const resetCursorLabel = useMemo(() => formatResetCursor(resetCursor), [resetCursor]);

  const loadPollPresets = useCallback(async (backgroundRefresh: boolean) => {
    if (!backgroundRefresh) {
      setPollPresetUiState("loading");
      setPollPresetUiMessage("");
    }

    try {
      const response = await fetch("/api/live-poll/presets", {
        method: "GET",
        cache: "no-store"
      });
      const data = (await response.json().catch(() => null)) as LivePollPresetApiResponse | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Hazır sorular alınamadı.");
      }

      setPollPresets(data?.presets ?? []);
      setPollPresetUiState("ready");
      setPollPresetUiMessage("");
    } catch (error) {
      setPollPresetUiState("error");
      setPollPresetUiMessage(error instanceof Error ? error.message : "Hazır sorular alınamadı.");
    }
  }, []);

  const applyPresetToDraft = useCallback((preset: LivePollPresetConfig) => {
    setPollQuestionDraft(preset.question);
    setPollOptionDrafts([...preset.options]);
    setPresetSaveUiMessage("Hazır soru taslağa dolduruldu.");
    setPresetSaveUiState("success");
  }, []);

  useEffect(() => {
    const storedCursor = localStorage.getItem(DASHBOARD_RESET_CURSOR_STORAGE_KEY)?.trim() ?? "";
    if (storedCursor && Number.isFinite(new Date(storedCursor).getTime())) {
      setResetCursor(storedCursor);
    }
    setResetCursorLoaded(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadActivePoll = async (backgroundRefresh: boolean) => {
      if (!backgroundRefresh) {
        setPollConfigUiState("loading");
        setPollConfigUiMessage("");
      }

      try {
        const response = await fetch("/api/live-poll", {
          method: "GET",
          cache: "no-store"
        });
        const data = (await response.json().catch(() => null)) as LivePollApiResponse | null;

        if (!response.ok) {
          throw new Error(data?.error ?? "Canlı anket alınamadı.");
        }

        if (!isMounted) {
          return;
        }

        const nextPoll = data?.activePoll ?? null;
        setActivePoll((prev) => (isSameActivePoll(prev, nextPoll) ? prev : nextPoll));
        setPollConfigUiState("ready");
        setPollConfigUiMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPollConfigUiState("error");
        setPollConfigUiMessage(
          error instanceof Error ? error.message : "Canlı anket bilgisi alınamadı."
        );
      }
    };

    void loadActivePoll(false);

    const interval = window.setInterval(() => {
      void loadActivePoll(true);
    }, 8000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    void loadPollPresets(false);
  }, [loadPollPresets]);

  useEffect(() => {
    if (!resetCursorLoaded) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const allowedPollOptions = new Set(activePollOptions);

    const applyAnalytics = (row: Pick<AnalyticsRow, "sentiment_score" | "top_keywords">) => {
      setSentiment(parseSentiment(row.sentiment_score));
      const parsedTopics = parseTopics(row.top_keywords);

      if (parsedTopics.topics.length > 0) {
        setTopTopics(parsedTopics.topics);
      }

      if (parsedTopics.summary) {
        setSummary(parsedTopics.summary);
      }

      setModeratorBrief(parsedTopics.moderatorBrief);
    };

    const loadInitialData = async () => {
      let countQuery = supabase.from("attendee_feedbacks").select("id", { count: "exact", head: true });
      let feedbackQuery = supabase
        .from("attendee_feedbacks")
        .select("id, message, created_at, is_analyzed")
        .order("created_at", { ascending: false })
        .limit(300);
      let analyticsQuery = supabase
        .from("congress_analytics")
        .select("sentiment_score, top_keywords, created_at")
        .order("created_at", { ascending: false })
        .limit(1);

      if (resetCursor) {
        countQuery = countQuery.gte("created_at", resetCursor);
        feedbackQuery = feedbackQuery.gte("created_at", resetCursor);
        analyticsQuery = analyticsQuery.gte("created_at", resetCursor);
      }

      const [countResult, feedbackResult, analyticsResult] = await Promise.all([
        countQuery,
        feedbackQuery,
        analyticsQuery.maybeSingle()
      ]);

      if (!countResult.error) {
        setTotalResponses(countResult.count ?? 0);
      }

      if (!feedbackResult.error) {
        const rows = feedbackResult.data ?? [];
        setLatestComments(getFilteredComments(rows));
        setPollCounts(getPollCounts(rows, activePoll));
      }

      if (!analyticsResult.error && analyticsResult.data) {
        applyAnalytics(analyticsResult.data);
      } else if (resetCursor) {
        setSentiment(DEFAULT_SENTIMENT);
        setSummary(RESET_SUMMARY);
        setTopTopics(DEFAULT_TOPICS);
        setModeratorBrief(EMPTY_MODERATOR_BRIEF);
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
          if (!isAfterResetCursor(row.created_at, resetCursor)) {
            return;
          }

          setTotalResponses((prev) => prev + 1);

          const pollResponse = parsePollResponse(row.message);
          if (pollResponse) {
            const matchesActivePoll = activePoll?.id
              ? pollResponse.pollId === activePoll.id
              : !pollResponse.pollId;

            if (matchesActivePoll && allowedPollOptions.has(pollResponse.option)) {
              setPollCounts((prev) => ({
                ...prev,
                [pollResponse.option]: (prev[pollResponse.option] ?? 0) + 1
              }));
            }
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
          const row = payload.new as AnalyticsRow;
          if (!isAfterResetCursor(row.created_at, resetCursor)) {
            return;
          }

          applyAnalytics(row);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(feedbackChannel);
      void supabase.removeChannel(analyticsChannel);
    };
  }, [activePoll, activePollOptions, resetCursor, resetCursorLoaded]);

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

  const handleResetDashboardView = () => {
    const nextCursor = new Date().toISOString();
    localStorage.setItem(DASHBOARD_RESET_CURSOR_STORAGE_KEY, nextCursor);
    setResetCursor(nextCursor);
    setTotalResponses(0);
    setLatestComments([]);
    setPollCounts(createEmptyPollCounts(activePollOptions));
    setSentiment(DEFAULT_SENTIMENT);
    setSummary(RESET_SUMMARY);
    setTopTopics(DEFAULT_TOPICS);
    setModeratorBrief(EMPTY_MODERATOR_BRIEF);
    setResetUiMessage("Panel görünümü sıfırlandı. Veritabanı verileri silinmedi.");
    setHardResetUiMessage("");
  };

  const handleHardResetDatabase = async () => {
    if (hardResetUiState === "loading") {
      return;
    }

    const confirmed = window.confirm(
      "Bu işlem Supabase'deki tüm geri bildirim ve analiz kayıtlarını kalıcı olarak siler. Devam etmek istiyor musunuz?"
    );

    if (!confirmed) {
      return;
    }

    setHardResetUiState("loading");
    setHardResetUiMessage("");

    try {
      const response = await fetch("/api/dashboard/reset-data", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ confirm: "DELETE_MESSAGES" })
      });

      const data = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            deleted_feedbacks?: number;
            deleted_analytics?: number;
            error?: string;
          }
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Veritabanı temizlenirken bir hata oluştu.");
      }

      const nextCursor = new Date().toISOString();
      localStorage.setItem(DASHBOARD_RESET_CURSOR_STORAGE_KEY, nextCursor);
      setResetCursor(nextCursor);
      setTotalResponses(0);
      setLatestComments([]);
      setPollCounts(createEmptyPollCounts(activePollOptions));
      setSentiment(DEFAULT_SENTIMENT);
      setSummary(RESET_SUMMARY);
      setTopTopics(DEFAULT_TOPICS);
      setModeratorBrief(EMPTY_MODERATOR_BRIEF);
      setAnalyzeUiMessage("");
      setResetUiMessage("Panel sıfırlandı. Veritabanındaki eski mesajlar kalıcı olarak silindi.");
      setHardResetUiState("success");
      setHardResetUiMessage(
        `Silinen kayıtlar: ${data.deleted_feedbacks ?? 0} geri bildirim, ${data.deleted_analytics ?? 0} analiz.`
      );
    } catch (error) {
      setHardResetUiState("error");
      setHardResetUiMessage(
        error instanceof Error ? error.message : "Veritabanı temizlenirken bir hata oluştu."
      );
    }
  };

  const handlePollOptionDraftChange = (index: number, value: string) => {
    setPollOptionDrafts((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? value.slice(0, POLL_OPTION_MAX_CHARS) : item
      )
    );
  };

  const handleAddPollOptionDraft = () => {
    setPollOptionDrafts((prev) => {
      if (prev.length >= MAX_POLL_OPTIONS) {
        return prev;
      }

      return [...prev, ""];
    });
  };

  const handleRemovePollOptionDraft = (index: number) => {
    setPollOptionDrafts((prev) => {
      if (prev.length <= MIN_POLL_OPTIONS) {
        return prev;
      }

      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const publishLivePollRequest = async (question: string, options: string[]) => {
    const response = await fetch("/api/live-poll", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        question,
        options
      })
    });

    const data = (await response.json().catch(() => null)) as LivePollApiResponse | null;

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error ?? "Anket yayınlanamadı.");
    }

    const nextPoll = data.activePoll ?? null;
    setActivePoll((prev) => (isSameActivePoll(prev, nextPoll) ? prev : nextPoll));
    setPollCounts(createEmptyPollCounts(getActivePollOptions(nextPoll)));
    setPollCloseUiState("idle");
    setPollConfigUiState("ready");
    setPollConfigUiMessage("");

    return data;
  };

  const handlePublishLivePoll = async () => {
    if (pollPublishUiState === "loading") {
      return;
    }

    const question = normalizePollDraftText(pollQuestionDraft, POLL_QUESTION_MAX_CHARS);
    const options = sanitizePollDraftOptions(pollOptionDrafts);

    if (question.length < 6) {
      setPollPublishUiState("error");
      setPollPublishUiMessage("Anket sorusu en az 6 karakter olmalı.");
      return;
    }

    if (options.length < MIN_POLL_OPTIONS) {
      setPollPublishUiState("error");
      setPollPublishUiMessage(`En az ${MIN_POLL_OPTIONS} seçenek girilmeli.`);
      return;
    }

    setPollPublishUiState("loading");
    setPollPublishUiMessage("");
    setPollCloseUiMessage("");

    try {
      const data = await publishLivePollRequest(question, options);
      setPollQuestionDraft("");
      setPollOptionDrafts(["", "", "", ""]);
      setPollPublishUiState("success");
      setPollPublishUiMessage(data.message ?? "Canlı anket yayınlandı.");
      setPresetSaveUiMessage("");
    } catch (error) {
      setPollPublishUiState("error");
      setPollPublishUiMessage(error instanceof Error ? error.message : "Anket yayınlanamadı.");
    }
  };

  const handleSavePollPreset = async () => {
    if (presetSaveUiState === "loading") {
      return;
    }

    const question = normalizePollDraftText(pollQuestionDraft, POLL_QUESTION_MAX_CHARS);
    const options = sanitizePollDraftOptions(pollOptionDrafts);

    if (question.length < 6) {
      setPresetSaveUiState("error");
      setPresetSaveUiMessage("Hazır soru için en az 6 karakterlik soru girilmelidir.");
      return;
    }

    if (options.length < MIN_POLL_OPTIONS) {
      setPresetSaveUiState("error");
      setPresetSaveUiMessage(`Hazır soru için en az ${MIN_POLL_OPTIONS} seçenek girilmelidir.`);
      return;
    }

    setPresetSaveUiState("loading");
    setPresetSaveUiMessage("");

    try {
      const response = await fetch("/api/live-poll/presets", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          question,
          options
        })
      });

      const data = (await response.json().catch(() => null)) as LivePollPresetApiResponse | null;

      if (!response.ok || !data?.ok || !data?.preset) {
        throw new Error(data?.error ?? "Hazır soru kaydedilemedi.");
      }

      setPollPresets((prev) => [data.preset as LivePollPresetConfig, ...prev].slice(0, 30));
      setPollPresetUiState("ready");
      setPollPresetUiMessage("");
      setPresetSaveUiState("success");
      setPresetSaveUiMessage(data.message ?? "Hazır soru kaydedildi.");
    } catch (error) {
      setPresetSaveUiState("error");
      setPresetSaveUiMessage(
        error instanceof Error ? error.message : "Hazır soru kaydedilemedi."
      );
    }
  };

  const handleLaunchPollPreset = async (preset: LivePollPresetConfig) => {
    if (presetLaunchingId) {
      return;
    }

    setPresetLaunchingId(preset.id);
    setPollPublishUiMessage("");
    setPollCloseUiMessage("");

    try {
      const data = await publishLivePollRequest(preset.question, preset.options);
      setPollPublishUiState("success");
      setPollPublishUiMessage(data.message ?? "Hazır soru yayına alındı.");
      setPresetSaveUiMessage("Hazır soru yayına alındı.");
      setPresetSaveUiState("success");
    } catch (error) {
      setPollPublishUiState("error");
      setPollPublishUiMessage(error instanceof Error ? error.message : "Hazır soru yayına alınamadı.");
    } finally {
      setPresetLaunchingId("");
    }
  };

  const handleDeletePollPreset = async (presetId: string) => {
    if (presetDeletingId) {
      return;
    }

    const confirmed = window.confirm("Bu hazır soruyu silmek istediğinizden emin misiniz?");
    if (!confirmed) {
      return;
    }

    setPresetDeletingId(presetId);
    setPollPresetUiMessage("");

    try {
      const response = await fetch("/api/live-poll/presets", {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          presetId
        })
      });

      const data = (await response.json().catch(() => null)) as LivePollPresetApiResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Hazır soru silinemedi.");
      }

      setPollPresets((prev) => prev.filter((preset) => preset.id !== presetId));
      setPollPresetUiState("ready");
      setPollPresetUiMessage(data.message ?? "Hazır soru silindi.");
    } catch (error) {
      setPollPresetUiState("error");
      setPollPresetUiMessage(error instanceof Error ? error.message : "Hazır soru silinemedi.");
    } finally {
      setPresetDeletingId("");
    }
  };

  const handleCloseLivePoll = async () => {
    if (pollCloseUiState === "loading") {
      return;
    }

    if (!activePoll) {
      setPollCloseUiState("error");
      setPollCloseUiMessage("Kapatılacak aktif anket bulunamadı.");
      return;
    }

    const confirmed = window.confirm(
      "Aktif canlı anketi kapatmak istediğinizden emin misiniz?"
    );
    if (!confirmed) {
      return;
    }

    setPollCloseUiState("loading");
    setPollCloseUiMessage("");
    setPollPublishUiMessage("");

    try {
      const response = await fetch("/api/live-poll", {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        }
      });

      const data = (await response.json().catch(() => null)) as LivePollApiResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Aktif anket kapatılamadı.");
      }

      setActivePoll(null);
      setPollCounts(createEmptyPollCounts(getActivePollOptions(null)));
      setPollCloseUiState("success");
      setPollCloseUiMessage(data.message ?? "Aktif anket kapatıldı.");
      setPollPublishUiState("idle");
      setPollConfigUiState("ready");
      setPollConfigUiMessage("");
    } catch (error) {
      setPollCloseUiState("error");
      setPollCloseUiMessage(error instanceof Error ? error.message : "Aktif anket kapatılamadı.");
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
            <div className="flex max-w-xl flex-col gap-3">
              <p className="text-sm leading-relaxed text-slate-300">
                28 Şubat 2026, Nâzım Hikmet Kültür Merkezi etkinliğinden gelen salon geri bildirimleri gerçek
                zamanlı olarak toplanır, yapay zeka ile analiz edilir ve anında güncellenir.
              </p>
              <Link
                href="/cekilispanel"
                className="inline-flex w-fit items-center gap-2 rounded-xl border border-cyan-200/35 bg-cyan-200/10 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/20"
              >
                <Gift className="h-4 w-4" />
                Çekiliş Merkezi
              </Link>
            </div>
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetDashboardView}
                      className="h-10 border-cyan-200/30 bg-cyan-200/10 px-4 text-cyan-50 hover:bg-cyan-200/20"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Mesajları Sıfırla
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleHardResetDatabase}
                      disabled={hardResetUiState === "loading"}
                      className="h-10 border-rose-300/40 bg-rose-500/15 px-4 text-rose-100 hover:bg-rose-500/25"
                    >
                      {hardResetUiState === "loading" ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Veriler Siliniyor...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Supabase&apos;i Temizle
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
                  {resetUiMessage ? (
                    <p className="text-xs text-cyan-100/80">{resetUiMessage}</p>
                  ) : null}
                  {hardResetUiMessage ? (
                    <p
                      className={`text-xs ${
                        hardResetUiState === "error" ? "text-rose-300" : "text-emerald-200"
                      }`}
                    >
                      {hardResetUiMessage}
                    </p>
                  ) : null}
                  {resetCursorLabel ? (
                    <p className="text-xs text-cyan-200/75">
                      Sıfırlama aktif. Bu panel {resetCursorLabel} sonrasındaki verileri gösteriyor.
                    </p>
                  ) : null}

                  <div className="space-y-3 rounded-2xl border border-cyan-200/20 bg-cyan-200/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-cyan-100">Canlı Anket Yönetimi</p>
                      <p
                        className={`text-xs font-medium ${
                          activePoll ? "text-emerald-200" : "text-slate-300"
                        }`}
                      >
                        {activePoll ? "Aktif anket yayında" : "Şu an aktif anket yok"}
                      </p>
                    </div>

                    {pollConfigUiState === "loading" ? (
                      <p className="text-xs text-cyan-200/80">Canlı anket durumu yükleniyor...</p>
                    ) : null}
                    {pollConfigUiMessage ? (
                      <p
                        className={`text-xs ${
                          pollConfigUiState === "error" ? "text-rose-300" : "text-cyan-200/80"
                        }`}
                      >
                        {pollConfigUiMessage}
                      </p>
                    ) : null}
                    {activePoll ? (
                      <div className="rounded-xl border border-cyan-200/20 bg-slate-900/30 px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-cyan-200/80">
                          Yayındaki Soru
                        </p>
                        <p className="mt-1 text-sm text-slate-100">{activePoll.question}</p>
                      </div>
                    ) : null}

                    <div className="space-y-1">
                      <label htmlFor="live-poll-question" className="text-xs font-medium text-cyan-100">
                        Yeni anket sorusu
                      </label>
                      <textarea
                        id="live-poll-question"
                        value={pollQuestionDraft}
                        onChange={(event) =>
                          setPollQuestionDraft(event.target.value.slice(0, POLL_QUESTION_MAX_CHARS))
                        }
                        rows={2}
                        className="w-full resize-none rounded-xl border border-cyan-200/25 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300"
                        placeholder="Örn: Bugün en çok hangi başlığı derinleştirelim?"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-cyan-100">Seçenekler</p>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 border-cyan-200/30 bg-cyan-200/10 px-3 text-xs text-cyan-50 hover:bg-cyan-200/20"
                          onClick={handleAddPollOptionDraft}
                          disabled={pollOptionDrafts.length >= MAX_POLL_OPTIONS}
                        >
                          Seçenek Ekle
                        </Button>
                      </div>

                      {pollOptionDrafts.map((option, index) => (
                        <div key={`poll-option-draft-${index}`} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(event) =>
                              handlePollOptionDraftChange(index, event.target.value)
                            }
                            className="h-9 w-full rounded-lg border border-cyan-200/25 bg-slate-900/40 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300"
                            placeholder={`Seçenek ${index + 1}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 border-rose-300/35 bg-rose-500/10 px-3 text-xs text-rose-100 hover:bg-rose-500/20"
                            onClick={() => handleRemovePollOptionDraft(index)}
                            disabled={pollOptionDrafts.length <= MIN_POLL_OPTIONS}
                          >
                            Sil
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        className="h-9 px-4"
                        onClick={handlePublishLivePoll}
                        disabled={pollPublishUiState === "loading"}
                      >
                        {pollPublishUiState === "loading" ? (
                          <>
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Yayınlanıyor...
                          </>
                        ) : (
                          "Anketi Yayınla"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 border-cyan-200/30 bg-cyan-200/10 px-4 text-cyan-50 hover:bg-cyan-200/20"
                        onClick={handleSavePollPreset}
                        disabled={presetSaveUiState === "loading"}
                      >
                        {presetSaveUiState === "loading" ? (
                          <>
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Kaydediliyor...
                          </>
                        ) : (
                          "Hazır Soruya Kaydet"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 border-amber-300/40 bg-amber-500/10 px-4 text-amber-50 hover:bg-amber-500/20"
                        onClick={handleCloseLivePoll}
                        disabled={!activePoll || pollCloseUiState === "loading"}
                      >
                        {pollCloseUiState === "loading" ? (
                          <>
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Kapatılıyor...
                          </>
                        ) : (
                          "Aktif Anketi Kapat"
                        )}
                      </Button>
                    </div>

                    {pollPublishUiMessage ? (
                      <p
                        className={`text-xs ${
                          pollPublishUiState === "error" ? "text-rose-300" : "text-emerald-200"
                        }`}
                      >
                        {pollPublishUiMessage}
                      </p>
                    ) : null}
                    {pollCloseUiMessage ? (
                      <p
                        className={`text-xs ${
                          pollCloseUiState === "error" ? "text-rose-300" : "text-amber-100"
                        }`}
                      >
                        {pollCloseUiMessage}
                      </p>
                    ) : null}

                    {presetSaveUiMessage ? (
                      <p
                        className={`text-xs ${
                          presetSaveUiState === "error" ? "text-rose-300" : "text-cyan-100"
                        }`}
                      >
                        {presetSaveUiMessage}
                      </p>
                    ) : null}

                    <div className="space-y-2 rounded-xl border border-cyan-200/15 bg-slate-900/25 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
                          Hazır Sorular
                        </p>
                        <p className="text-xs text-cyan-100/70">{pollPresets.length} kayıt</p>
                      </div>

                      {pollPresetUiState === "loading" ? (
                        <p className="text-xs text-cyan-100/75">Hazır sorular yükleniyor...</p>
                      ) : null}

                      {pollPresetUiMessage ? (
                        <p
                          className={`text-xs ${
                            pollPresetUiState === "error" ? "text-rose-300" : "text-cyan-100"
                          }`}
                        >
                          {pollPresetUiMessage}
                        </p>
                      ) : null}

                      {pollPresets.length === 0 && pollPresetUiState !== "loading" ? (
                        <p className="text-xs text-slate-300">
                          Henüz kayıtlı hazır soru yok. Taslağı doldurup kaydedebilirsiniz.
                        </p>
                      ) : null}

                      {pollPresets.length > 0 ? (
                        <div className="space-y-2">
                          {pollPresets.map((preset) => (
                            <div
                              key={preset.id}
                              className="rounded-xl border border-cyan-200/15 bg-slate-900/35 p-3"
                            >
                              <p className="text-sm font-medium text-white">{preset.question}</p>
                              <p className="mt-1 text-xs text-cyan-100/70">
                                {preset.options.join(" • ")}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 border-cyan-200/30 bg-cyan-200/10 px-3 text-xs text-cyan-50 hover:bg-cyan-200/20"
                                  onClick={() => applyPresetToDraft(preset)}
                                >
                                  Taslağa Doldur
                                </Button>
                                <Button
                                  type="button"
                                  className="h-8 px-3 text-xs"
                                  onClick={() => handleLaunchPollPreset(preset)}
                                  disabled={presetLaunchingId === preset.id}
                                >
                                  {presetLaunchingId === preset.id ? (
                                    <>
                                      <LoaderCircle className="h-4 w-4 animate-spin" />
                                      Yayına Alınıyor...
                                    </>
                                  ) : (
                                    "Hızlı Yayınla"
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 border-rose-300/35 bg-rose-500/10 px-3 text-xs text-rose-100 hover:bg-rose-500/20"
                                  onClick={() => handleDeletePollPreset(preset.id)}
                                  disabled={presetDeletingId === preset.id}
                                >
                                  {presetDeletingId === preset.id ? (
                                    <>
                                      <LoaderCircle className="h-4 w-4 animate-spin" />
                                      Siliniyor...
                                    </>
                                  ) : (
                                    "Sil"
                                  )}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
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
                      labelStyle={{ color: "#bae6fd" }}
                      itemStyle={{ color: "#f8fafc" }}
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
              <p className="text-xs font-medium uppercase tracking-wide text-cyan-200/80">
                {activePoll ? "Yayındaki anket" : "Varsayılan anket"}
              </p>
              <p className="mb-3 mt-1 text-sm text-slate-300">{activePollPrompt}</p>
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
