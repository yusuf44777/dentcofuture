"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const COUNTDOWN_START = 5;
const CONFETTI_COLORS = ["#fde68a", "#6ee7b7", "#fda4af", "#93c5fd", "#fef3c7", "#c4b5fd"];
const CONFETTI_PIECES = Array.from({ length: 90 }, (_, index) => ({
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  delay: `${(index % 18) * 0.045}s`,
  duration: `${2.5 + (index % 7) * 0.16}s`,
  left: `${(index * 37) % 100}%`,
  size: `${6 + (index % 5) * 2}px`,
  drift: `${((index % 9) - 4) * 42}px`,
  rotation: `${220 + (index % 8) * 65}deg`
}));

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
  const hasInitializedWinnersRef = useRef(false);
  const latestSeenWinnerIdRef = useRef("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [participantsActive, setParticipantsActive] = useState(0);
  const [recentDraws, setRecentDraws] = useState<PublicRaffleDraw[]>([]);
  const [activePrizes, setActivePrizes] = useState<PublicRafflePrize[]>([]);
  const [displayedWinner, setDisplayedWinner] = useState<PublicRaffleDraw | null>(null);
  const [pendingWinner, setPendingWinner] = useState<PublicRaffleDraw | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [confettiBurstKey, setConfettiBurstKey] = useState("");

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
  const visibleRecentDraws = useMemo(
    () => recentDraws.filter((draw) => draw.id !== pendingWinner?.id).slice(0, 5),
    [pendingWinner?.id, recentDraws]
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

  useEffect(() => {
    if (loadState !== "ready") {
      return;
    }

    if (!hasInitializedWinnersRef.current) {
      hasInitializedWinnersRef.current = true;
      latestSeenWinnerIdRef.current = latestWinner?.id ?? "";
      setDisplayedWinner(latestWinner);
      return;
    }

    if (!latestWinner) {
      latestSeenWinnerIdRef.current = "";
      setDisplayedWinner(null);
      setPendingWinner(null);
      setIsCountingDown(false);
      setCountdown(COUNTDOWN_START);
      return;
    }

    if (latestWinner.id === latestSeenWinnerIdRef.current) {
      return;
    }

    latestSeenWinnerIdRef.current = latestWinner.id;
    setPendingWinner(latestWinner);
    setCountdown(COUNTDOWN_START);
    setIsCountingDown(true);
  }, [latestWinner, loadState]);

  useEffect(() => {
    if (!isCountingDown || !pendingWinner) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          setDisplayedWinner(pendingWinner);
          setPendingWinner(null);
          setIsCountingDown(false);
          setConfettiBurstKey(`${pendingWinner.id}-${Date.now()}`);
          return COUNTDOWN_START;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isCountingDown, pendingWinner]);

  useEffect(() => {
    if (!confettiBurstKey) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setConfettiBurstKey("");
    }, 4500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [confettiBurstKey]);

  return (
    <main className="h-screen overflow-hidden bg-[#080807] px-4 py-4 text-stone-50 sm:px-6 lg:px-8">
      {confettiBurstKey ? (
        <div
          key={confettiBurstKey}
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
          aria-hidden="true"
        >
          {CONFETTI_PIECES.map((piece, index) => (
            <span
              key={`confetti-${confettiBurstKey}-${index}`}
              className="raffle-confetti-piece"
              style={
                {
                  "--confetti-color": piece.color,
                  "--confetti-delay": piece.delay,
                  "--confetti-duration": piece.duration,
                  "--confetti-drift": piece.drift,
                  "--confetti-rotation": piece.rotation,
                  backgroundColor: piece.color,
                  height: piece.size,
                  left: piece.left,
                  width: piece.size
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      <section className="mx-auto flex h-full w-full max-w-[1900px] flex-col gap-3 overflow-hidden">
        <header className="flex shrink-0 flex-col gap-3 border-b border-amber-200/20 pb-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">
              <Sparkles className="h-4 w-4" />
              Communitive Dentistry
            </p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-white lg:text-5xl 2xl:text-6xl">
              DentCo Outliers Çekilişi
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right">
            <div className="rounded-lg border border-stone-700 bg-stone-950/70 px-4 py-2">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Katılımcı</p>
              <p className="text-3xl font-semibold text-white">{participantsActive}</p>
            </div>
            <div className="rounded-lg border border-stone-700 bg-stone-950/70 px-4 py-2">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Çekilen</p>
              <p className="text-3xl font-semibold text-amber-200">{prizeTotals.drawn}</p>
            </div>
            <div className="rounded-lg border border-stone-700 bg-stone-950/70 px-4 py-2">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Kalan</p>
              <p className="text-3xl font-semibold text-emerald-200">{prizeTotals.remaining}</p>
            </div>
          </div>
        </header>

        {loadState === "error" ? (
          <div className="rounded-lg border border-rose-400/40 bg-rose-950/45 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(430px,0.65fr)]">
          <article className="relative flex min-h-0 flex-col justify-between overflow-hidden rounded-lg border border-amber-200/30 bg-[linear-gradient(135deg,#16110a_0%,#0d0c0b_48%,#101915_100%)] p-5 shadow-2xl shadow-amber-950/30 lg:p-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-white to-emerald-300" />
            <div className="flex items-center justify-between gap-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/80">
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

            {isCountingDown && pendingWinner ? (
              <div className="flex min-h-0 flex-1 animate-fade-up flex-col items-center justify-center py-4 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-100/80">
                  Kazanan açıklanıyor
                </p>
                <div className="relative mt-6 flex h-48 w-48 items-center justify-center rounded-full border border-amber-200/35 bg-amber-200/10 shadow-[0_0_80px_rgba(253,230,138,0.18)] 2xl:h-56 2xl:w-56">
                  <div className="absolute inset-0 rounded-full border border-amber-200/30 animate-ping" />
                  <p className="relative text-8xl font-black leading-none text-amber-100 2xl:text-9xl">
                    {countdown}
                  </p>
                </div>
                <p className="mt-6 max-w-3xl truncate text-2xl font-semibold text-white 2xl:text-4xl">
                  {pendingWinner.prize_title}
                </p>
                <p className="mt-3 text-sm uppercase tracking-[0.2em] text-stone-400">
                  Kod birazdan açıklanacak
                </p>
              </div>
            ) : displayedWinner ? (
              <div key={displayedWinner.id} className="flex min-h-0 flex-1 animate-fade-up flex-col justify-center py-4">
                <p className="max-w-full overflow-hidden whitespace-nowrap text-6xl font-black leading-none tracking-[0.04em] text-amber-100 sm:text-7xl xl:text-8xl 2xl:text-[8.5rem]">
                  {displayedWinner.winner_code}
                </p>
                <div className="mt-6 max-w-5xl border-l-4 border-amber-300 pl-5">
                  <p className="truncate text-3xl font-semibold text-white sm:text-4xl 2xl:text-5xl">
                    {displayedWinner.winner_name}
                  </p>
                  <p className="mt-3 truncate text-xl font-medium text-emerald-100 sm:text-2xl 2xl:text-3xl">
                    {displayedWinner.prize_title}
                  </p>
                  <p className="mt-2 text-sm uppercase tracking-[0.18em] text-stone-400">
                    Tur {displayedWinner.draw_number} • {formatDateTime(displayedWinner.drawn_at)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col justify-center py-6">
                <p className="max-w-4xl text-5xl font-black leading-none tracking-tight text-white sm:text-6xl 2xl:text-7xl">
                  Çekiliş Başlamak Üzere
                </p>
                <p className="mt-5 text-xl text-stone-300 2xl:text-2xl">
                  İlk kazanan kodu burada görünecek.
                </p>
              </div>
            )}

            <div className="grid shrink-0 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-400">
                  <Users className="h-4 w-4" />
                  Havuz
                </p>
                <p className="text-2xl font-semibold text-white">{participantsActive}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-400">
                  <Gift className="h-4 w-4" />
                  Ödül
                </p>
                <p className="text-2xl font-semibold text-white">{activePrizes.length}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-stone-400">
                  <Clock3 className="h-4 w-4" />
                  Toplam
                </p>
                <p className="text-2xl font-semibold text-white">{prizeTotals.quantity}</p>
              </div>
            </div>
          </article>

          <aside className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(128px,0.32fr)] gap-3">
            <section className="flex min-h-0 flex-col rounded-lg border border-stone-700 bg-stone-950/70 p-4">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Gift className="h-5 w-5 text-amber-200" />
                  Ödül Akışı
                </h2>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  {prizeTotals.drawn}/{prizeTotals.quantity}
                </p>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-hidden 2xl:grid-cols-3">
                {activePrizes.length === 0 ? (
                  <p className="col-span-2 rounded-lg border border-dashed border-stone-700 px-4 py-8 text-center text-sm text-stone-400">
                    Ödül bekleniyor.
                  </p>
                ) : (
                  activePrizes.map((prize) => {
                    const percent =
                      prize.quantity > 0
                        ? Math.min(100, Math.round((prize.draw_count / prize.quantity) * 100))
                        : 0;

                    return (
                      <div key={prize.id} className="rounded-lg border border-stone-800 bg-stone-900/70 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold leading-snug text-stone-100">{prize.title}</p>
                          <p className="shrink-0 text-[11px] font-semibold text-amber-200">
                            {prize.remaining} kaldı
                          </p>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-stone-800">
                          <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-amber-300 to-emerald-300 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded-lg border border-stone-700 bg-stone-950/70 p-4">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Trophy className="h-5 w-5 text-emerald-200" />
                  Kazananlar
                </h2>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Son {visibleRecentDraws.length}
                </p>
              </div>
              <div className="grid min-h-0 flex-1 content-start gap-2 overflow-hidden">
                {visibleRecentDraws.map((draw) => (
                  <div
                    key={draw.id}
                    className="grid grid-cols-[minmax(96px,0.3fr)_minmax(0,1fr)] gap-3 rounded-lg border border-stone-800 bg-stone-900/60 px-3 py-1.5"
                  >
                    <p className="truncate text-xs font-black tracking-[0.06em] text-amber-100">
                      {draw.winner_code}
                    </p>
                    <div>
                      <p className="truncate text-xs font-semibold text-stone-100">{draw.winner_name}</p>
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
