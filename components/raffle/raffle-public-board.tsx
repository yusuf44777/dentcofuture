"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, LoaderCircle, Sparkles, Trophy, Users } from "lucide-react";
import { AppPageSwitcher } from "@/components/navigation/app-page-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PublicRaffleDraw = {
  id: string;
  prize_id: string;
  prize_title: string;
  draw_number: number;
  winner_code: string;
  winner_name: string;
  drawn_at: string;
};

type PublicRaffleResponse = {
  participants_active?: number;
  recent_draws?: PublicRaffleDraw[];
  error?: string;
};

type LoadState = "loading" | "ready" | "error";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function RafflePublicBoard() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [participantsActive, setParticipantsActive] = useState(0);
  const [recentDraws, setRecentDraws] = useState<PublicRaffleDraw[]>([]);

  const latestWinner = useMemo(() => recentDraws[0] ?? null, [recentDraws]);

  const loadPublicRaffle = useCallback(async () => {
    try {
      if (loadState !== "ready") {
        setLoadState("loading");
      }

      const response = await fetch("/api/raffle/public", {
        method: "GET",
        cache: "no-store"
      });
      const data = (await response.json()) as PublicRaffleResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Çekiliş verisi alınamadı.");
      }

      setParticipantsActive(data.participants_active ?? 0);
      setRecentDraws(data.recent_draws ?? []);
      setLoadState("ready");
      setErrorMessage("");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "Çekiliş verisi alınamadı.");
    }
  }, [loadState]);

  useEffect(() => {
    void loadPublicRaffle();

    const intervalId = window.setInterval(() => {
      void loadPublicRaffle();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadPublicRaffle]);

  return (
    <main className="min-h-screen px-4 py-6 sm:py-8">
      <section className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div className="text-center">
          <Badge className="bg-cyan-50 text-cyan-800">COMMUNITIVE DENTISTRY • Çekiliş</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Dent Co Future Çekiliş Ekranı
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Ödül kazanan kodları bu ekranda canlı olarak güncellenir.
          </p>
        </div>

        <AppPageSwitcher />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-700" />
              Aktif Katılımcı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{participantsActive}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyan-700" />
              Son Kazanan Kod
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadState === "loading" ? (
              <p className="inline-flex items-center gap-2 text-sm text-cyan-800">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Çekiliş verisi yükleniyor...
              </p>
            ) : null}

            {loadState === "error" ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMessage}
              </p>
            ) : null}

            {loadState === "ready" && latestWinner ? (
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
                  Kazanan Kod
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-[0.08em] text-slate-900">
                  {latestWinner.winner_code}
                </p>
                <p className="mt-2 text-sm text-slate-700">{latestWinner.winner_name}</p>
                <p className="text-xs text-cyan-700">
                  {latestWinner.prize_title} • Tur {latestWinner.draw_number}
                </p>
              </div>
            ) : null}

            {loadState === "ready" && !latestWinner ? (
              <p className="text-sm text-slate-600">
                Henüz çekiliş yapılmadı. İlk kazanan kodu burada görünecek.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-cyan-700" />
              Sonuç Geçmişi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentDraws.slice(0, 8).map((draw) => (
              <div
                key={draw.id}
                className="rounded-xl border border-cyan-100 bg-white px-3 py-2"
              >
                <p className="text-xs font-semibold text-slate-900">
                  {draw.winner_code} • {draw.winner_name}
                </p>
                <p className="text-[11px] text-slate-600">
                  {draw.prize_title} • Tur {draw.draw_number} • {formatDateTime(draw.drawn_at)}
                </p>
              </div>
            ))}
            {recentDraws.length === 0 ? (
              <p className="text-xs text-slate-500">Henüz geçmiş sonuç bulunmuyor.</p>
            ) : null}
          </CardContent>
        </Card>

        <p className="flex items-center justify-center gap-1 text-xs text-cyan-700">
          <Sparkles className="h-4 w-4" />
          Kodunuz açıklandığında görevli ekibe ileterek ödülünüzü alabilirsiniz.
        </p>
      </section>
    </main>
  );
}
