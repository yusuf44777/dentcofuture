"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MAX_CHARS = 200;

type SubmissionState = "idle" | "loading" | "success" | "error";

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const charactersLeft = useMemo(() => MAX_CHARS - message.length, [message.length]);
  const canSubmit = message.trim().length > 0 && state !== "loading";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setState("loading");
    setErrorMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("attendee_feedbacks").insert({
        message: message.trim()
      });

      if (error) {
        throw error;
      }

      setMessage("");
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

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">
          {charactersLeft} karakter kaldı
        </p>
        {state === "success" && (
          <p className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Başarıyla kaydedildi
          </p>
        )}
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
            Gönder
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
