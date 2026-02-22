"use client";

import { type ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Gift,
  LoaderCircle,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Trophy,
  Upload,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";

type RafflePrizeSummary = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  allow_previous_winner: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  draw_count: number;
  remaining: number;
  is_completed: boolean;
};

type RaffleRecentDraw = {
  id: string;
  prize_id: string;
  prize_title: string;
  draw_number: number;
  winner_code: string;
  winner_name: string;
  drawn_at: string;
};

type RaffleOverviewResponse = {
  stats?: {
    participants_total: number;
    participants_active: number;
    active_prizes: number;
    total_draws: number;
  };
  prizes?: RafflePrizeSummary[];
  recent_draws?: RaffleRecentDraw[];
  error?: string;
};

type ImportResponse = {
  ok?: boolean;
  parsed_lines?: number;
  imported_total?: number;
  inserted_count?: number;
  updated_count?: number;
  invalid_lines?: Array<{ line: number; value: string; reason: string }>;
  sample_codes?: Array<{ full_name: string; participant_code: string }>;
  error?: string;
};

type ParticipantRow = {
  id: string;
  full_name: string;
  participant_code: string;
  external_ref: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ParticipantsResponse = {
  participants?: ParticipantRow[];
  error?: string;
};

type DrawResponse = {
  ok?: boolean;
  winner?: {
    draw_id: string;
    prize_id: string;
    prize_title: string;
    draw_number: number;
    winner_participant_id: string;
    winner_code: string;
    winner_name: string;
    drawn_at: string;
  };
  progress?: {
    drawn: number;
    quantity: number;
    remaining: number;
    is_completed: boolean;
  };
  error?: string;
};

type RequestState = "idle" | "loading" | "success" | "error";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

interface RaffleAdminConsoleProps {
  speakerPanelPath?: string;
}

export function RaffleAdminConsole({ speakerPanelPath = "/konusmacipanel" }: RaffleAdminConsoleProps) {
  const [overview, setOverview] = useState<RaffleOverviewResponse | null>(null);
  const [overviewState, setOverviewState] = useState<RequestState>("loading");
  const [overviewMessage, setOverviewMessage] = useState("");

  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [participantsState, setParticipantsState] = useState<RequestState>("idle");
  const [participantsMessage, setParticipantsMessage] = useState("");
  const [participantsQuery, setParticipantsQuery] = useState("");

  const [importRows, setImportRows] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importState, setImportState] = useState<RequestState>("idle");
  const [importMessage, setImportMessage] = useState("");
  const [importDetail, setImportDetail] = useState<ImportResponse | null>(null);

  const [prizeTitle, setPrizeTitle] = useState("");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [prizeQuantity, setPrizeQuantity] = useState("1");
  const [allowPreviousWinner, setAllowPreviousWinner] = useState(false);
  const [createPrizeState, setCreatePrizeState] = useState<RequestState>("idle");
  const [createPrizeMessage, setCreatePrizeMessage] = useState("");

  const [selectedPrizeId, setSelectedPrizeId] = useState("");
  const [drawState, setDrawState] = useState<RequestState>("idle");
  const [drawMessage, setDrawMessage] = useState("");
  const [latestWinner, setLatestWinner] = useState<DrawResponse["winner"] | null>(null);

  const overviewPrizes = overview?.prizes;
  const overviewRecentDraws = overview?.recent_draws;
  const prizes = useMemo(() => overviewPrizes ?? [], [overviewPrizes]);
  const recentDraws = useMemo(() => overviewRecentDraws ?? [], [overviewRecentDraws]);

  const activePrizeOptions = useMemo(
    () => prizes.filter((prize) => prize.is_active && prize.remaining > 0),
    [prizes]
  );

  const loadOverview = useCallback(async (silent = false) => {
    if (!silent) {
      setOverviewState("loading");
      setOverviewMessage("");
    }

    try {
      const response = await fetch("/api/raffle/overview", {
        method: "GET",
        cache: "no-store"
      });

      const data = (await response.json()) as RaffleOverviewResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Çekiliş özeti alınamadı.");
      }

      setOverview(data);
      setOverviewState("success");
      setOverviewMessage("");
      setSelectedPrizeId((previousPrizeId) => {
        if (previousPrizeId && (data.prizes ?? []).some((prize) => prize.id === previousPrizeId)) {
          return previousPrizeId;
        }

        const fallbackPrize =
          (data.prizes ?? []).find((prize) => prize.is_active && !prize.is_completed) ??
          (data.prizes ?? [])[0];

        return fallbackPrize?.id ?? "";
      });
    } catch (error) {
      setOverviewState("error");
      setOverviewMessage(error instanceof Error ? error.message : "Çekiliş özeti alınamadı.");
    }
  }, []);

  const loadParticipants = useCallback(async (query: string) => {
    setParticipantsState("loading");
    setParticipantsMessage("");

    try {
      const searchParams = new URLSearchParams();
      searchParams.set("limit", "12");
      if (query.trim()) {
        searchParams.set("q", query.trim());
      }

      const response = await fetch(`/api/raffle/participants?${searchParams.toString()}`, {
        method: "GET",
        cache: "no-store"
      });
      const data = (await response.json()) as ParticipantsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Katılımcı listesi alınamadı.");
      }

      setParticipants(data.participants ?? []);
      setParticipantsState("success");
      setParticipantsMessage("");
    } catch (error) {
      setParticipantsState("error");
      setParticipantsMessage(
        error instanceof Error ? error.message : "Katılımcı listesi alınamadı."
      );
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    void loadParticipants("");

    const intervalId = window.setInterval(() => {
      void loadOverview(true);
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadOverview, loadParticipants]);

  const handleImportParticipants = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (importState === "loading") {
      return;
    }

    if (importRows.trim().length === 0) {
      setImportState("error");
      setImportMessage("Katılımcı satırları boş olamaz.");
      return;
    }

    setImportState("loading");
    setImportMessage("");
    setImportDetail(null);

    try {
      const response = await fetch("/api/raffle/participants/import", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ rows: importRows })
      });

      const data = (await response.json()) as ImportResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Katılımcılar içe aktarılamadı.");
      }

      setImportState("success");
      setImportDetail(data);
      setImportMessage(
        `Aktarım tamamlandı. Yeni: ${data.inserted_count ?? 0}, güncellenen: ${
          data.updated_count ?? 0
        }, geçersiz satır: ${data.invalid_lines?.length ?? 0}.`
      );

      setImportRows("");
      void loadOverview();
      void loadParticipants(participantsQuery);
    } catch (error) {
      setImportState("error");
      setImportMessage(
        error instanceof Error ? error.message : "Katılımcılar içe aktarılamadı."
      );
    }
  };

  const handleImportFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      setImportRows(content);
      setImportFileName(file.name);
      setImportState("idle");
      setImportMessage(`${file.name} yüklendi. İsterseniz düzenleyip içe aktarabilirsiniz.`);
      setImportDetail(null);
    } catch {
      setImportState("error");
      setImportMessage("Dosya okunamadı. Lütfen tekrar deneyin.");
    } finally {
      event.target.value = "";
    }
  };

  const handleImportProjectCsv = async () => {
    if (importState === "loading") {
      return;
    }

    setImportState("loading");
    setImportMessage("");
    setImportDetail(null);

    try {
      const response = await fetch("/api/raffle/participants/import-project-csv", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        }
      });

      const data = (await response.json()) as ImportResponse & { source?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "cekilis.csv içe aktarılamadı.");
      }

      setImportState("success");
      setImportDetail(data);
      setImportMessage(
        `${data.source ?? "Dosya"} içe aktarıldı. Yeni: ${data.inserted_count ?? 0}, güncellenen: ${
          data.updated_count ?? 0
        }, geçersiz satır: ${data.invalid_lines?.length ?? 0}.`
      );
      setImportRows("");
      setImportFileName("cekilis.csv");
      void loadOverview();
      void loadParticipants(participantsQuery);
    } catch (error) {
      setImportState("error");
      setImportMessage(
        error instanceof Error ? error.message : "cekilis.csv içe aktarılamadı."
      );
    }
  };

  const handleCreatePrize = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (createPrizeState === "loading") {
      return;
    }

    const quantity = Number(prizeQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      setCreatePrizeState("error");
      setCreatePrizeMessage("Ödül adedi 1-100 arasında bir tam sayı olmalı.");
      return;
    }

    setCreatePrizeState("loading");
    setCreatePrizeMessage("");

    try {
      const response = await fetch("/api/raffle/prizes", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title: prizeTitle,
          description: prizeDescription,
          quantity,
          allowPreviousWinner
        })
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Ödül oluşturulamadı.");
      }

      setCreatePrizeState("success");
      setCreatePrizeMessage("Ödül başarıyla eklendi.");
      setPrizeTitle("");
      setPrizeDescription("");
      setPrizeQuantity("1");
      setAllowPreviousWinner(false);
      void loadOverview();
    } catch (error) {
      setCreatePrizeState("error");
      setCreatePrizeMessage(error instanceof Error ? error.message : "Ödül oluşturulamadı.");
    }
  };

  const handleDraw = async () => {
    if (!selectedPrizeId || drawState === "loading") {
      return;
    }

    setDrawState("loading");
    setDrawMessage("");

    try {
      const response = await fetch("/api/raffle/draw", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          prizeId: selectedPrizeId
        })
      });

      const data = (await response.json()) as DrawResponse;
      if (!response.ok || !data.ok || !data.winner) {
        throw new Error(data.error ?? "Çekiliş çalıştırılamadı.");
      }

      setDrawState("success");
      setLatestWinner(data.winner);
      setDrawMessage(
        `${data.winner.prize_title} için ${data.winner.draw_number}. kazanan kodu üretildi.`
      );
      void loadOverview();
    } catch (error) {
      setDrawState("error");
      setDrawMessage(error instanceof Error ? error.message : "Çekiliş çalıştırılamadı.");
    }
  };

  return (
    <main className="dashboard-surface subtle-grid min-h-screen px-4 py-4 text-slate-100 md:px-8 md:py-6">
      <section className="mx-auto flex w-full max-w-[1760px] flex-col gap-6">
        <header className="glass-panel rounded-2xl px-5 py-5 md:px-8 md:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                Moderatör Çekiliş Merkezi
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Dent Co Future Çekiliş Sistemi
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Katılımcı kodlarını güvenli biçimde yükleyin, ödül bazında çekiliş başlatın ve kazanan
                kodunu anında açıklayın.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={speakerPanelPath}>
                <Button
                  type="button"
                  variant="outline"
                  className="border-cyan-200/30 bg-cyan-200/10 text-cyan-50 hover:bg-cyan-200/20"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Canlı Pano
                </Button>
              </Link>
              <Button
                type="button"
                variant="outline"
                className="border-cyan-200/30 bg-cyan-200/10 text-cyan-50 hover:bg-cyan-200/20"
                onClick={() => {
                  void loadOverview();
                  void loadParticipants(participantsQuery);
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Veriyi Yenile
              </Button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="glass-panel rounded-2xl p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-cyan-200/80">
              <Users className="h-4 w-4" />
              Toplam Katılımcı
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {overview?.stats?.participants_total ?? 0}
            </p>
            <p className="mt-1 text-xs text-cyan-100/75">
              Aktif: {overview?.stats?.participants_active ?? 0}
            </p>
          </article>

          <article className="glass-panel rounded-2xl p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-cyan-200/80">
              <Gift className="h-4 w-4" />
              Aktif Ödül
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {overview?.stats?.active_prizes ?? 0}
            </p>
          </article>

          <article className="glass-panel rounded-2xl p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-cyan-200/80">
              <Trophy className="h-4 w-4" />
              Toplam Çekiliş
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{overview?.stats?.total_draws ?? 0}</p>
          </article>

          <article className="glass-panel rounded-2xl p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-cyan-200/80">
              <Clock3 className="h-4 w-4" />
              Durum
            </p>
            {overviewState === "loading" ? (
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-cyan-100">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Yükleniyor
              </p>
            ) : (
              <p className="mt-2 text-sm text-cyan-100">
                {overviewState === "error" ? overviewMessage : "Sistem hazır"}
              </p>
            )}
          </article>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="grid gap-6">
            <article className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <Upload className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Katılımcı İçe Aktarma</h2>
              </div>
              <form className="space-y-3" onSubmit={handleImportParticipants}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-cyan-200/30 bg-cyan-200/10 px-3 py-2 text-xs font-medium text-cyan-50 transition hover:bg-cyan-200/20">
                    <Upload className="h-4 w-4" />
                    CSV/TXT Dosyası Seç
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleImportFileSelect}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-cyan-100/75">
                    {importFileName ? `Seçilen dosya: ${importFileName}` : "Örn: cekilis.csv"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleImportProjectCsv}
                    disabled={importState === "loading"}
                    className="border-cyan-200/30 bg-cyan-200/10 text-cyan-50 hover:bg-cyan-200/20"
                  >
                    {importState === "loading" ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        İçe Aktarılıyor...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Projedeki cekilis.csv&apos;yi İçe Aktar
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-cyan-100/75">
                    Tek tıkla proje kökündeki `cekilis.csv` dosyasını yükler.
                  </p>
                </div>
                <textarea
                  value={importRows}
                  onChange={(event) => setImportRows(event.target.value)}
                  placeholder={
                    "Satır formatları:\nAd Soyad\nAd Soyad | KOD123\nAd Soyad;KOD123;Ref\nAd Soyad, KOD123"
                  }
                  className="min-h-40 w-full rounded-2xl border border-cyan-100/20 bg-slate-950/35 px-3 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-500"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button type="submit" disabled={importState === "loading"}>
                    {importState === "loading" ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        İçe Aktarılıyor...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Katılımcıları İçe Aktar
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-cyan-100/75">
                    Kod boş bırakılırsa sistem otomatik `DCF-` formatında kod üretir.
                  </p>
                </div>
              </form>

              {importMessage ? (
                <p
                  className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                    importState === "error"
                      ? "border-rose-300/40 bg-rose-500/15 text-rose-100"
                      : "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                  }`}
                >
                  {importMessage}
                </p>
              ) : null}

              {importDetail?.sample_codes && importDetail.sample_codes.length > 0 ? (
                <div className="mt-3 rounded-xl border border-cyan-100/15 bg-slate-900/35 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
                    Örnek Kodlar
                  </p>
                  <ul className="mt-2 grid gap-2 text-xs text-slate-100 sm:grid-cols-2">
                    {importDetail.sample_codes.slice(0, 6).map((row) => (
                      <li key={`${row.participant_code}-${row.full_name}`} className="rounded-lg bg-slate-900/40 px-2 py-1.5">
                        <span className="font-semibold text-cyan-100">{row.participant_code}</span>{" "}
                        <span className="text-slate-300">• {row.full_name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>

            <article className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <Sparkles className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Ödül Tanımla</h2>
              </div>
              <form className="space-y-3" onSubmit={handleCreatePrize}>
                <input
                  value={prizeTitle}
                  onChange={(event) => setPrizeTitle(event.target.value)}
                  placeholder="Örn: iPad Çekilişi"
                  className="h-11 w-full rounded-xl border border-cyan-100/20 bg-slate-950/35 px-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-500"
                  required
                />
                <textarea
                  value={prizeDescription}
                  onChange={(event) => setPrizeDescription(event.target.value)}
                  placeholder="Ödül açıklaması (opsiyonel)"
                  className="min-h-20 w-full rounded-xl border border-cyan-100/20 bg-slate-950/35 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-500"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={prizeQuantity}
                    onChange={(event) => setPrizeQuantity(event.target.value)}
                    className="h-11 w-full rounded-xl border border-cyan-100/20 bg-slate-950/35 px-3 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-500"
                  />
                  <label className="flex items-center gap-2 rounded-xl border border-cyan-100/20 bg-slate-950/35 px-3 text-sm text-cyan-50">
                    <input
                      type="checkbox"
                      checked={allowPreviousWinner}
                      onChange={(event) => setAllowPreviousWinner(event.target.checked)}
                      className="h-4 w-4 rounded border-cyan-200 bg-transparent"
                    />
                    Önceki kazanan tekrar kazanabilir
                  </label>
                </div>
                <Button type="submit" disabled={createPrizeState === "loading"}>
                  {createPrizeState === "loading" ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Ekleniyor...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="h-4 w-4" />
                      Ödülü Kaydet
                    </>
                  )}
                </Button>
              </form>
              {createPrizeMessage ? (
                <p
                  className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                    createPrizeState === "error"
                      ? "border-rose-300/40 bg-rose-500/15 text-rose-100"
                      : "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                  }`}
                >
                  {createPrizeMessage}
                </p>
              ) : null}
            </article>

            <article className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <Users className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Katılımcı Önizleme</h2>
              </div>
              <form
                className="mb-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadParticipants(participantsQuery);
                }}
              >
                <input
                  value={participantsQuery}
                  onChange={(event) => setParticipantsQuery(event.target.value)}
                  placeholder="Ad veya kod ile ara"
                  className="h-10 flex-1 rounded-xl border border-cyan-100/20 bg-slate-950/35 px-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-500"
                />
                <Button type="submit" variant="outline" className="border-cyan-200/30 bg-cyan-200/10 text-cyan-50 hover:bg-cyan-200/20">
                  Ara
                </Button>
              </form>
              {participantsState === "error" ? (
                <p className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
                  {participantsMessage}
                </p>
              ) : null}
              {participantsState === "loading" ? (
                <p className="inline-flex items-center gap-2 text-xs text-cyan-100/80">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Katılımcılar yükleniyor...
                </p>
              ) : null}
              <div className="mt-2 grid gap-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="rounded-xl border border-cyan-100/15 bg-slate-900/30 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-white">{participant.full_name}</p>
                    <p className="text-xs text-cyan-100/80">{participant.participant_code}</p>
                  </div>
                ))}
                {participantsState !== "loading" && participants.length === 0 ? (
                  <p className="text-xs text-slate-400">Katılımcı listesi henüz boş.</p>
                ) : null}
              </div>
            </article>
          </div>

          <div className="grid gap-6">
            <article className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <PlayCircle className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Çekilişi Başlat</h2>
              </div>
              <div className="space-y-3">
                <select
                  value={selectedPrizeId}
                  onChange={(event) => setSelectedPrizeId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-cyan-100/20 bg-slate-950/35 px-3 text-sm text-white outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <option value="">Ödül seçin</option>
                  {activePrizeOptions.map((prize) => (
                    <option key={prize.id} value={prize.id}>
                      {prize.title} ({prize.remaining} kaldı)
                    </option>
                  ))}
                </select>
                <Button type="button" disabled={!selectedPrizeId || drawState === "loading"} onClick={handleDraw}>
                  {drawState === "loading" ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Çekiliş Çalışıyor...
                    </>
                  ) : (
                    <>
                      <Trophy className="h-4 w-4" />
                      Kazanan Kodu Üret
                    </>
                  )}
                </Button>
              </div>

              {drawMessage ? (
                <p
                  className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                    drawState === "error"
                      ? "border-rose-300/40 bg-rose-500/15 text-rose-100"
                      : "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                  }`}
                >
                  {drawMessage}
                </p>
              ) : null}

              {latestWinner ? (
                <div className="mt-4 animate-pulse rounded-2xl border border-cyan-200/35 bg-gradient-to-br from-cyan-500/20 to-teal-400/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/90">
                    Son Kazanan Kodu
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-[0.08em] text-white">
                    {latestWinner.winner_code}
                  </p>
                  <p className="mt-2 text-sm text-cyan-100">{latestWinner.winner_name}</p>
                  <p className="text-xs text-cyan-100/80">
                    {latestWinner.prize_title} • Tur {latestWinner.draw_number}
                  </p>
                </div>
              ) : null}
            </article>

            <article className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <Gift className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Ödüller</h2>
              </div>
              <div className="space-y-3">
                {prizes.length === 0 ? (
                  <p className="text-sm text-slate-400">Henüz ödül tanımlanmadı.</p>
                ) : (
                  prizes.map((prize) => {
                    const percent =
                      prize.quantity > 0
                        ? Math.min(100, Math.round((prize.draw_count / prize.quantity) * 100))
                        : 0;
                    return (
                      <div
                        key={prize.id}
                        className="rounded-xl border border-cyan-100/15 bg-slate-900/30 px-3 py-3"
                      >
                        <p className="text-sm font-medium text-white">{prize.title}</p>
                        <p className="mt-1 text-xs text-cyan-100/80">
                          {prize.draw_count}/{prize.quantity} çekildi • Kalan: {prize.remaining}
                        </p>
                        <div className="mt-2 h-2 rounded-full bg-slate-800/80">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-slate-400">
                          {prize.is_active ? "Aktif" : "Pasif"} •{" "}
                          {prize.allow_previous_winner
                            ? "Tekrar kazanmaya izin var"
                            : "Tekrar kazanmaya izin yok"}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </article>

            <article className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-cyan-100">
                <Clock3 className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Son Çekilişler</h2>
              </div>
              <div className="space-y-2">
                {recentDraws.length === 0 ? (
                  <p className="text-sm text-slate-400">Henüz çekiliş yapılmadı.</p>
                ) : (
                  recentDraws.slice(0, 10).map((draw) => (
                    <div
                      key={draw.id}
                      className="rounded-xl border border-cyan-100/15 bg-slate-900/30 px-3 py-2"
                    >
                      <p className="text-xs text-cyan-100/90">
                        <span className="font-semibold">{draw.winner_code}</span> • {draw.winner_name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {draw.prize_title} • Tur {draw.draw_number} • {formatDateTime(draw.drawn_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
