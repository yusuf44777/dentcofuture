"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ListChecks, LoaderCircle, MessageSquareText, Send } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createPollMessage,
  type LivePollConfig,
  LIVE_POLL_OPTIONS,
  LIVE_POLL_PROMPT,
  type ResponseMode
} from "@/lib/engagement";

type SubmissionState = "idle" | "loading" | "success" | "error";
type PollConfigUiState = "loading" | "ready" | "error";

type LivePollApiResponse = {
  activePoll?: LivePollConfig | null;
  error?: string;
};

export function FeedbackForm() {
  const [mode, setMode] = useState<ResponseMode>("text");
  const [message, setMessage] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [state, setState] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [activePoll, setActivePoll] = useState<LivePollConfig | null>(null);
  const [pollConfigUiState, setPollConfigUiState] = useState<PollConfigUiState>("loading");
  const [pollConfigMessage, setPollConfigMessage] = useState("");

  const isTextMode = mode === "text";
  const pollPrompt = activePoll?.question ?? LIVE_POLL_PROMPT;
  const pollOptions = useMemo(
    () => (activePoll?.options?.length ? activePoll.options : [...LIVE_POLL_OPTIONS]),
    [activePoll]
  );

  useEffect(() => {
    let isMounted = true;

    const loadPoll = async () => {
      try {
        const response = await fetch("/api/live-poll", {
          method: "GET",
          cache: "no-store"
        });
        const data = (await response.json().catch(() => null)) as LivePollApiResponse | null;

        if (!response.ok) {
          throw new Error(data?.error ?? "Canlı anket bilgisi alınamadı.");
        }

        if (!isMounted) {
          return;
        }

        setActivePoll(data?.activePoll ?? null);
        setPollConfigUiState("ready");
        setPollConfigMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPollConfigUiState("error");
        setPollConfigMessage(
          error instanceof Error ? error.message : "Canlı anket bilgisi alınamadı."
        );
      }
    };

    void loadPoll();

    const interval = window.setInterval(() => {
      void loadPoll();
    }, 12000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedOption) {
      return;
    }

    if (!pollOptions.includes(selectedOption)) {
      setSelectedOption("");
    }
  }, [pollOptions, selectedOption]);

  const canSubmit = useMemo(() => {
    if (state === "loading") {
      return false;
    }

    return isTextMode ? message.trim().length > 0 : selectedOption.length > 0;
  }, [isTextMode, message, selectedOption, state]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setState("loading");
    setErrorMessage("");

    try {
      if (!isTextMode && !selectedOption) {
        setState("idle");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const payloadMessage = isTextMode
        ? message.trim()
        : createPollMessage(selectedOption, activePoll?.id);

      const { error } = await supabase.from("attendee_feedbacks").insert({
        message: payloadMessage
      });

      if (error) {
        throw error;
      }

      if (isTextMode) {
        setMessage("");
      } else {
        setSelectedOption("");
      }
      setState("success");

      window.setTimeout(() => {
        setState("idle");
      }, 2200);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Gönderim sırasında bir hata oluştu.");
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-cyan-50 p-1.5">
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
            mode === "text"
              ? "bg-white text-cyan-900 shadow-sm"
              : "text-slate-600 hover:bg-white/70 hover:text-slate-800"
          }`}
        >
          <MessageSquareText className="h-4 w-4" />
          Serbest Yanıt
        </button>
        <button
          type="button"
          onClick={() => setMode("poll")}
          className={`flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
            mode === "poll"
              ? "bg-white text-cyan-900 shadow-sm"
              : "text-slate-600 hover:bg-white/70 hover:text-slate-800"
          }`}
        >
          <ListChecks className="h-4 w-4" />
          Çoktan Seçmeli
        </button>
      </div>

      {isTextMode ? (
        <>
          <label htmlFor="feedback" className="text-sm font-medium text-slate-700">
            Kongre hakkındaki düşünceleriniz veya sorularınız nelerdir?
          </label>
          <Textarea
            id="feedback"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Örn: Panelde dijital diş hekimliğinde etik sınırlar konuşulabilir mi?"
            required
          />
        </>
      ) : (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-slate-700">{pollPrompt}</legend>
          {pollConfigUiState === "loading" ? (
            <p className="text-xs text-slate-500">Canlı anket kontrol ediliyor...</p>
          ) : null}
          {pollConfigUiState === "error" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {pollConfigMessage}
            </p>
          ) : null}
          {activePoll ? (
            <p className="text-xs font-medium text-cyan-700">Canlı anket yayında</p>
          ) : (
            <p className="text-xs text-slate-500">Varsayılan anket gösteriliyor</p>
          )}
          <div className="space-y-2.5">
            {pollOptions.map((option, index) => {
              const optionId = `poll-option-${index + 1}`;
              const checked = selectedOption === option;

              return (
                <label
                  key={option}
                  htmlFor={optionId}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
                    checked
                      ? "border-cyan-400 bg-cyan-50 text-cyan-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/40"
                  }`}
                >
                  <input
                    id={optionId}
                    type="radio"
                    name="poll-option"
                    checked={checked}
                    onChange={() => setSelectedOption(option)}
                    className="h-4 w-4 accent-cyan-600"
                    required
                  />
                  <span className="text-sm font-medium">{option}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">
          {isTextMode ? "Açık uçlu geri bildirim modu" : "Anket modu"}
        </p>
        {state === "success" ? (
          <p className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Başarıyla kaydedildi
          </p>
        ) : null}
      </div>

      <Button className="w-full" size="lg" type="submit" disabled={!canSubmit}>
        {state === "loading" ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Gönderiliyor...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Yanıtı Gönder
          </>
        )}
      </Button>

      {state === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
