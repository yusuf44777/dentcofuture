"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, ListChecks, LoaderCircle, MessageSquareText, Send } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createPollMessage,
  type LivePollOption,
  LIVE_POLL_OPTIONS,
  LIVE_POLL_PROMPT,
  type ResponseMode
} from "@/lib/engagement";

const MAX_CHARS = 200;

type SubmissionState = "idle" | "loading" | "success" | "error";

export function FeedbackForm() {
  const [mode, setMode] = useState<ResponseMode>("text");
  const [message, setMessage] = useState("");
  const [selectedOption, setSelectedOption] = useState<LivePollOption | "">("");
  const [state, setState] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const charactersLeft = useMemo(() => MAX_CHARS - message.length, [message.length]);
  const isTextMode = mode === "text";
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
        : createPollMessage(selectedOption as LivePollOption);

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
            onChange={(event) => setMessage(event.target.value.slice(0, MAX_CHARS))}
            maxLength={MAX_CHARS}
            placeholder="Örn: Panelde dijital diş hekimliğinde etik sınırlar konuşulabilir mi?"
            required
          />
          <p className="text-xs font-medium text-slate-500">{charactersLeft} karakter kaldı</p>
        </>
      ) : (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-slate-700">{LIVE_POLL_PROMPT}</legend>
          <div className="space-y-2.5">
            {LIVE_POLL_OPTIONS.map((option, index) => {
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
