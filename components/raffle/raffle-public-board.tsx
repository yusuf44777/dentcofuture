"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Gift, LoaderCircle, Sparkles, Trophy, Users } from "lucide-react";

type PublicRaffleDraw = {
  id: string;
  prize_id: string;
  prize_title: string;
  draw_number: number;
  winner_code: string;
  winner_name: string;
  drawn_at: string;
};

type PublicRafflePrize = {
  id: string;
  title: string;
  quantity: number;
  draw_count: number;
  remaining: number;
};

type PublicRaffleResponse = {
  participants_active?: number;
  recent_draws?: PublicRaffleDraw[];
  active_prizes?: PublicRafflePrize[];
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
  const [activePrizes, setActivePrizes] = useState<PublicRafflePrize[]>([]);

  const latestWinner = useMemo(() => recentDraws[0] ?? null, [recentDraws]);
  const prizeTotals = useMemo(
    () =>
      activePrizes.reduce(
        (acc, prize) => ({
          quantity: acc.quantity + (prize.quantity ?? 0),
          drawn: acc.drawn + (prize.draw_count ?? 0),
          remaining: acc.remaining + (prize.remaining ?? 0)
        }),
        { quantity: 0, drawn: 0, remaining: 0 }
      ),
    [activePrizes]
  );

  const loadPublicRaffle = useCallback(async (backgroundRefresh = false) => {
    try {
      if (!backgroundRefresh) {
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
      setActivePrizes(data.active_prizes ?? []);
      setLoadState("ready");
      setErrorMessage("");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(error instanceof Error ? error.message : "Çekiliş verisi alınamadı.");
    }
  }, []);

  useEffect(() => {
    void loadPublicRaffle();

    const intervalId = window.setInterval(() => {
      void loadPublicRaffle(true);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadPublicRaffle]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#080807] px-5 py-5 text-stone-50 sm:px-8 lg:px-10">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[1800px] flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-amber-200/20 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-amber-200/80">
              <Sparkles className="h-4 w-4" />
              Communitive Dentistry
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-7xl">
              Dent Co Future Çekilişi
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-3 text-right">
            <div className="rounded-lg border border-stone-700 bg-stone-950/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Katılımcı</p>
              <p className="mt-1 text-3xl font-semibold text-white">{participantsActive}</p>
            </div>
            <div className="rounded-lg border border-stone-700 bg-stone-950/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Çekilen</p>
              <p className="mt-1 text-3xl font-semibold text-amber-200">{prizeTotals.drawn}</p>
            </div>
            <div className="rounded-lg border border-stone-700 bg-stone-950/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Kalan</p>
              <p className="mt-1 text-3xl font-semibold text-emerald-200">{prizeTotals.remaining}</p>
            </div>
          </div>
        </header>

        {loadState === "error" ? (
          <div className="rounded-lg border border-rose-400/40 bg-rose-950/45 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid flex-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <article className="relative flex min-h-[460px] flex-col justify-between overflow-hidden rounded-lg border border-amber-200/30 bg-[linear-gradient(135deg,#16110a_0%,#0d0c0b_48%,#101915_100%)] p-6 shadow-2xl shadow-amber-950/30 sm:p-8 lg:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-white to-emerald-300" />
            <div className="flex items-center justify-between gap-4">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-amber-100/80">
                <Trophy className="h-5 w-5" />
                Son Kazanan
              </p>
              {loadState === "loading" ? (
                <p className="inline-flex items-center gap-2 text-sm text-stone-300">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Yükleniyor
                </p>
              ) : null}
            </div>

            {latestWinner ? (
              <div key={latestWinner.id} className="animate-fade-up py-8">
                <p className="max-w-[15ch] break-words text-7xl font-black leading-none tracking-[0.08em] text-amber-100 sm:text-8xl lg:text-[9.5rem]">
                  {latestWinner.winner_code}
                </p>
                <div className="mt-8 max-w-5xl border-l-4 border-amber-300 pl-5">
                  <p className="text-3xl font-semibold text-white sm:text-5xl">
                    {latestWinner.winner_name}
                  </p>
                  <p className="mt-4 text-xl font-medium text-emerald-100 sm:text-3xl">
                    {latestWinner.prize_title}
                  </p>
                  <p className="mt-2 text-sm uppercase tracking-[0.18em] text-stone-400">
                    Tur {latestWinner.draw_number} • {formatDateTime(latestWinner.drawn_at)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-16">
                <p className="max-w-4xl text-6xl font-black leading-none tracking-tight text-white sm:text-7xl lg:text-8xl">
                  Çekiliş Başlamak Üzere
                </p>
                <p className="mt-6 text-2xl text-stone-300">
                  İlk kazanan kodu burada görünecek.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-400">
                  <Users className="h-4 w-4" />
                  Havuz
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">{participantsActive}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-400">
                  <Gift className="h-4 w-4" />
                  Ödül
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">{activePrizes.length}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-400">
                  <Clock3 className="h-4 w-4" />
                  Toplam
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">{prizeTotals.quantity}</p>
              </div>
            </div>
          </article>

          <aside className="grid gap-5">
            <section className="rounded-lg border border-stone-700 bg-stone-950/70 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Gift className="h-5 w-5 text-amber-200" />
                  Ödül Akışı
                </h2>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  {prizeTotals.drawn}/{prizeTotals.quantity}
                </p>
              </div>
              <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
                {activePrizes.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-stone-700 px-4 py-8 text-center text-sm text-stone-400">
                    Ödül bekleniyor.
                  </p>
                ) : (
                  activePrizes.map((prize) => {
                    const percent =
                      prize.quantity > 0
                        ? Math.min(100, Math.round((prize.draw_count / prize.quantity) * 100))
                        : 0;

                    return (
                      <div key={prize.id} className="rounded-lg border border-stone-800 bg-stone-900/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold leading-snug text-stone-100">{prize.title}</p>
                          <p className="shrink-0 text-xs font-semibold text-amber-200">
                            {prize.remaining} kaldı
                          </p>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-stone-800">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-amber-300 to-emerald-300 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-lg border border-stone-700 bg-stone-950/70 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Trophy className="h-5 w-5 text-emerald-200" />
                  Kazananlar
                </h2>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Son {Math.min(recentDraws.length, 8)}
                </p>
              </div>
              <div className="max-h-[32vh] space-y-2 overflow-y-auto pr-1">
                {recentDraws.slice(0, 8).map((draw) => (
                  <div
                    key={draw.id}
                    className="grid grid-cols-[minmax(88px,0.28fr)_minmax(0,1fr)] gap-3 rounded-lg border border-stone-800 bg-stone-900/60 px-3 py-2"
                  >
                    <p className="break-words text-sm font-black tracking-[0.08em] text-amber-100">
                      {draw.winner_code}
                    </p>
                    <div>
                      <p className="truncate text-sm font-semibold text-stone-100">{draw.winner_name}</p>
                      <p className="truncate text-xs text-stone-400">{draw.prize_title}</p>
                    </div>
                  </div>
                ))}
                {recentDraws.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-stone-700 px-4 py-8 text-center text-sm text-stone-400">
                    Kazanan bekleniyor.
                  </p>
                ) : null}
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
