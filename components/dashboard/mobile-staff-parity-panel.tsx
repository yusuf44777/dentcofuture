"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Images,
  LoaderCircle,
  Pin,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";

type StaffQuestion = {
  id: string;
  text: string;
  votes: number;
  pinned: boolean;
  answered: boolean;
  attendee?: { name?: string; role?: string } | Array<{ name?: string; role?: string }> | null;
};

type Participant = {
  id: string;
  full_name: string;
  participant_code: string | null;
  external_ref: string | null;
  is_active: boolean;
};

type OutliersImportDetail = {
  ok?: boolean;
  source?: string;
  detail?: string;
  parsed_lines?: number;
  migrated_total?: number;
  inserted_count?: number;
  updated_count?: number;
  has_header?: boolean;
  sample_rows?: Array<{
    full_name: string;
    email: string;
    phone: string;
    status: "inserted" | "updated";
  }>;
  invalid_lines?: Array<{
    line: number;
    value: string;
    reason: string;
  }>;
  error?: string;
};

type GalleryItem = {
  id: string;
  uploader_name: string;
  caption: string | null;
  media_type: "photo" | "video";
  public_url: string;
  file_size: number;
  drive_backup_status: "pending" | "synced" | "failed" | "disabled";
  drive_error: string | null;
  created_at: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getAttendeeName(attendee: StaffQuestion["attendee"]) {
  if (!attendee) {
    return "Katılımcı";
  }

  if (Array.isArray(attendee)) {
    return attendee[0]?.name?.trim() || "Katılımcı";
  }

  return attendee.name?.trim() || "Katılımcı";
}

function formatDate(value: string) {
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

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
}

function getBackupBadgeClass(status: GalleryItem["drive_backup_status"]) {
  if (status === "synced") {
    return "bg-emerald-500/20 text-emerald-200";
  }
  if (status === "failed") {
    return "bg-rose-500/20 text-rose-200";
  }
  if (status === "disabled") {
    return "bg-cyan-500/20 text-cyan-100";
  }

  return "bg-cyan-500/20 text-cyan-100";
}

function getBackupLabel(status: GalleryItem["drive_backup_status"]) {
  if (status === "synced") {
    return "Drive: Tamam";
  }
  if (status === "failed") {
    return "Drive: Hata";
  }
  if (status === "disabled") {
    return "Drive: Pasif";
  }

  return "Drive: Bekliyor";
}

export function MobileStaffParityPanel() {
  const [questions, setQuestions] = useState<StaffQuestion[]>([]);
  const [questionsMessage, setQuestionsMessage] = useState("");
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionActionId, setQuestionActionId] = useState("");

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsMessage, setParticipantsMessage] = useState("");
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [participantActionId, setParticipantActionId] = useState("");
  const [participantSearchDraft, setParticipantSearchDraft] = useState("");
  const [participantSearchValue, setParticipantSearchValue] = useState("");
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantCode, setNewParticipantCode] = useState("");
  const [newParticipantExternalRef, setNewParticipantExternalRef] = useState("");
  const [creatingParticipant, setCreatingParticipant] = useState(false);
  const [outliersCsvRows, setOutliersCsvRows] = useState("");
  const [outliersCsvFileName, setOutliersCsvFileName] = useState("");
  const [outliersImportState, setOutliersImportState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [outliersImportMessage, setOutliersImportMessage] = useState("");
  const [outliersImportDetail, setOutliersImportDetail] = useState<OutliersImportDetail | null>(null);

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryMessage, setGalleryMessage] = useState("");
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryActionId, setGalleryActionId] = useState("");

  const galleryStats = useMemo(() => {
    const photos = galleryItems.filter((item) => item.media_type === "photo").length;
    const videos = galleryItems.filter((item) => item.media_type === "video").length;
    const synced = galleryItems.filter((item) => item.drive_backup_status === "synced").length;
    const failed = galleryItems.filter((item) => item.drive_backup_status === "failed").length;

    return {
      total: galleryItems.length,
      photos,
      videos,
      synced,
      failed
    };
  }, [galleryItems]);

  const loadQuestions = useCallback(async (silent = false) => {
    if (!silent) {
      setQuestionsLoading(true);
      setQuestionsMessage("");
    }

    try {
      const response = await fetch("/api/dashboard/questions", {
        method: "GET",
        cache: "no-store"
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; questions?: StaffQuestion[]; error?: string }
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Sorular alınamadı.");
      }

      setQuestions(data.questions ?? []);
    } catch (error) {
      setQuestionsMessage(getErrorMessage(error, "Sorular alınamadı."));
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  const loadParticipants = useCallback(async (query: string, silent = false) => {
    if (!silent) {
      setParticipantsLoading(true);
      setParticipantsMessage("");
    }

    try {
      const search = new URLSearchParams();
      search.set("limit", "80");
      if (query.trim()) {
        search.set("q", query.trim());
      }

      const response = await fetch(`/api/raffle/participants?${search.toString()}`, {
        method: "GET",
        cache: "no-store"
      });
      const data = (await response.json().catch(() => null)) as
        | { participants?: Participant[]; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Katılımcı listesi alınamadı.");
      }

      setParticipants(data?.participants ?? []);
    } catch (error) {
      setParticipantsMessage(getErrorMessage(error, "Katılımcı listesi alınamadı."));
    } finally {
      setParticipantsLoading(false);
    }
  }, []);

  const loadGallery = useCallback(async (silent = false) => {
    if (!silent) {
      setGalleryLoading(true);
      setGalleryMessage("");
    }

    try {
      const search = new URLSearchParams();
      search.set("limit", "40");

      const response = await fetch(`/api/gallery?${search.toString()}`, {
        method: "GET",
        cache: "no-store"
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; items?: GalleryItem[]; error?: string }
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Galeri verisi alınamadı.");
      }

      setGalleryItems(data.items ?? []);
    } catch (error) {
      setGalleryMessage(getErrorMessage(error, "Galeri verisi alınamadı."));
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuestions(false);
    void loadParticipants(participantSearchValue, false);
    void loadGallery(false);

    const interval = window.setInterval(() => {
      void loadQuestions(true);
      void loadParticipants(participantSearchValue, true);
      void loadGallery(true);
    }, 12000);

    return () => window.clearInterval(interval);
  }, [loadGallery, loadParticipants, loadQuestions, participantSearchValue]);

  const updateQuestion = useCallback(
    async (questionId: string, updates: { pinned?: boolean; answered?: boolean }) => {
      setQuestionActionId(questionId);
      setQuestionsMessage("");

      try {
        const response = await fetch("/api/dashboard/questions", {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            questionId,
            ...updates
          })
        });

        const data = (await response.json().catch(() => null)) as
          | { ok?: boolean; question?: StaffQuestion; error?: string }
          | null;

        if (!response.ok || !data?.ok || !data.question) {
          throw new Error(data?.error ?? "Soru güncellenemedi.");
        }

        setQuestions((prev) => prev.map((item) => (item.id === questionId ? data.question! : item)));
      } catch (error) {
        setQuestionsMessage(getErrorMessage(error, "Soru güncellenemedi."));
      } finally {
        setQuestionActionId("");
      }
    },
    []
  );

  const createParticipant = useCallback(async () => {
    if (creatingParticipant) {
      return;
    }

    const fullName = newParticipantName.trim();
    if (fullName.length < 2) {
      setParticipantsMessage("Ad soyad en az 2 karakter olmalıdır.");
      return;
    }

    setCreatingParticipant(true);
    setParticipantsMessage("");

    try {
      const response = await fetch("/api/raffle/participants", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          fullName,
          participantCode: newParticipantCode.trim() || undefined,
          externalRef: newParticipantExternalRef.trim() || undefined
        })
      });

      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; participant?: Participant; error?: string }
        | null;

      if (!response.ok || !data?.ok || !data.participant) {
        throw new Error(data?.error ?? "Katılımcı eklenemedi.");
      }

      setNewParticipantName("");
      setNewParticipantCode("");
      setNewParticipantExternalRef("");
      setParticipants((prev) => [data.participant!, ...prev].slice(0, 80));
      setParticipantsMessage("Katılımcı eklendi.");
    } catch (error) {
      setParticipantsMessage(getErrorMessage(error, "Katılımcı eklenemedi."));
    } finally {
      setCreatingParticipant(false);
    }
  }, [creatingParticipant, newParticipantCode, newParticipantExternalRef, newParticipantName]);

  const toggleParticipant = useCallback(async (participantId: string, isActive: boolean) => {
    setParticipantActionId(participantId);
    setParticipantsMessage("");

    try {
      const response = await fetch("/api/raffle/participants", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          participantId,
          isActive: !isActive
        })
      });

      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; participant?: Participant; error?: string }
        | null;

      if (!response.ok || !data?.ok || !data.participant) {
        throw new Error(data?.error ?? "Katılımcı güncellenemedi.");
      }

      setParticipants((prev) => prev.map((item) => (item.id === participantId ? data.participant! : item)));
    } catch (error) {
      setParticipantsMessage(getErrorMessage(error, "Katılımcı güncellenemedi."));
    } finally {
      setParticipantActionId("");
    }
  }, []);

  const handleOutliersCsvFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      setOutliersCsvRows(content);
      setOutliersCsvFileName(file.name);
      setOutliersImportState("idle");
      setOutliersImportMessage(`${file.name} yüklendi. "CSV'den migrate et" ile devam edebilirsin.`);
      setOutliersImportDetail(null);
    } catch (error) {
      setOutliersImportState("error");
      setOutliersImportMessage(getErrorMessage(error, "CSV dosyası okunamadı."));
      setOutliersImportDetail(null);
    } finally {
      event.target.value = "";
    }
  }, []);

  const migrateOutliersCsv = useCallback(async () => {
    if (outliersImportState === "loading") {
      return;
    }

    if (outliersCsvRows.trim().length === 0) {
      setOutliersImportState("error");
      setOutliersImportMessage("Önce CSV dosyası seçin.");
      return;
    }

    setOutliersImportState("loading");
    setOutliersImportMessage("");
    setOutliersImportDetail(null);

    try {
      const response = await fetch("/api/admin/outliers/participants/import", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ rows: outliersCsvRows })
      });
      const data = (await response.json().catch(() => null)) as OutliersImportDetail | null;

      if (!response.ok || !data?.ok) {
        setOutliersImportDetail(data);
        throw new Error(data?.detail ?? data?.error ?? "CSV migrate işlemi başarısız.");
      }

      setOutliersImportState("success");
      setOutliersImportDetail(data);
      setOutliersImportMessage(
        `${data.migrated_total ?? 0} satır işlendi. ${data.inserted_count ?? 0} yeni, ${
          data.updated_count ?? 0
        } güncelleme.`
      );
    } catch (error) {
      setOutliersImportState("error");
      setOutliersImportMessage(getErrorMessage(error, "CSV migrate işlemi başarısız."));
    }
  }, [outliersCsvRows, outliersImportState]);

  const migrateProjectOutliersCsv = useCallback(async () => {
    if (outliersImportState === "loading") {
      return;
    }

    setOutliersImportState("loading");
    setOutliersImportMessage("");
    setOutliersImportDetail(null);

    try {
      const response = await fetch("/api/admin/outliers/participants/import-project-csv", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        }
      });
      const data = (await response.json().catch(() => null)) as OutliersImportDetail | null;

      if (!response.ok || !data?.ok) {
        setOutliersImportDetail(data);
        throw new Error(data?.detail ?? data?.error ?? "Proje CSV migrate işlemi başarısız.");
      }

      setOutliersImportState("success");
      setOutliersImportDetail(data);
      setOutliersImportMessage(
        `${data.source ?? "outliers_katilimci.csv"} işlendi. ${data.inserted_count ?? 0} yeni, ${
          data.updated_count ?? 0
        } güncelleme.`
      );
    } catch (error) {
      setOutliersImportState("error");
      setOutliersImportMessage(getErrorMessage(error, "Proje CSV migrate işlemi başarısız."));
    }
  }, [outliersImportState]);

  const deleteGalleryItem = useCallback(async (itemId: string) => {
    if (galleryActionId) {
      return;
    }

    const confirmed = window.confirm("Bu medya kaydını galeriden silmek istiyor musunuz?");
    if (!confirmed) {
      return;
    }

    setGalleryActionId(itemId);
    setGalleryMessage("");

    try {
      const response = await fetch(`/api/gallery/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        }
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Galeri kaydı silinemedi.");
      }

      setGalleryItems((prev) => prev.filter((item) => item.id !== itemId));
      setGalleryMessage("Galeri kaydı silindi.");
    } catch (error) {
      setGalleryMessage(getErrorMessage(error, "Galeri kaydı silinemedi."));
    } finally {
      setGalleryActionId("");
    }
  }, [galleryActionId]);

  return (
    <article className="glass-panel rounded-3xl p-5 md:col-span-2 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-cyan-100">
        <Users className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Mobil Operasyon Eşitlemesi</h3>
      </div>
      <p className="mb-5 text-sm text-slate-300">
        Mobil staff panelde olan canlı soru ve katılımcı operasyonlarına ek olarak, çekiliş yerine galeri
        içerikleri bu alana eklendi.
      </p>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-cyan-200/15 bg-slate-900/25 p-4">
          <div className="mb-3 flex items-center gap-2 text-cyan-100">
            <Pin className="h-4 w-4" />
            <h4 className="text-sm font-semibold">Canlı Sorular</h4>
          </div>
          {questionsLoading ? (
            <p className="text-xs text-slate-300">Sorular yükleniyor...</p>
          ) : null}
          {questionsMessage ? <p className="mb-2 text-xs text-rose-300">{questionsMessage}</p> : null}
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {questions.slice(0, 30).map((question) => (
              <div
                key={question.id}
                className="rounded-xl border border-cyan-200/15 bg-slate-950/45 px-3 py-2"
              >
                <p className="text-sm text-slate-100">{question.text}</p>
                <p className="mt-1 text-xs text-cyan-100/70">
                  {getAttendeeName(question.attendee)} • {question.votes} oy
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-cyan-200/30 bg-cyan-200/10 px-3 text-xs text-cyan-50 hover:bg-cyan-200/20"
                    onClick={() =>
                      void updateQuestion(question.id, {
                        pinned: !question.pinned
                      })
                    }
                    disabled={questionActionId === question.id}
                  >
                    {questionActionId === question.id ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Pin className="h-3.5 w-3.5" />
                    )}
                    {question.pinned ? "Sabitlemeyi Kaldır" : "Sabitle"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-emerald-300/30 bg-emerald-500/10 px-3 text-xs text-emerald-100 hover:bg-emerald-500/20"
                    onClick={() =>
                      void updateQuestion(question.id, {
                        answered: !question.answered
                      })
                    }
                    disabled={questionActionId === question.id}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {question.answered ? "Yanıtı Geri Al" : "Cevaplandı"}
                  </Button>
                </div>
              </div>
            ))}
            {!questionsLoading && questions.length === 0 ? (
              <p className="text-xs text-slate-400">Henüz canlı soru yok.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-200/15 bg-slate-900/25 p-4">
          <div className="mb-3 flex items-center gap-2 text-cyan-100">
            <UserPlus className="h-4 w-4" />
            <h4 className="text-sm font-semibold">Katılımcılar</h4>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={newParticipantName}
              onChange={(event) => setNewParticipantName(event.target.value)}
              className="h-9 w-full rounded-lg border border-cyan-200/25 bg-slate-900/40 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300"
              placeholder="Ad soyad"
            />
            <input
              type="text"
              value={newParticipantCode}
              onChange={(event) => setNewParticipantCode(event.target.value)}
              className="h-9 w-full rounded-lg border border-cyan-200/25 bg-slate-900/40 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300"
              placeholder="Katılımcı kodu"
            />
            <input
              type="text"
              value={newParticipantExternalRef}
              onChange={(event) => setNewParticipantExternalRef(event.target.value)}
              className="h-9 w-full rounded-lg border border-cyan-200/25 bg-slate-900/40 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300"
              placeholder="Dış referans"
            />
            <Button
              type="button"
              className="h-9 px-4 text-xs"
              onClick={() => void createParticipant()}
              disabled={creatingParticipant}
            >
              {creatingParticipant ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Ekleniyor...
                </>
              ) : (
                "Katılımcı Ekle"
              )}
            </Button>
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-cyan-200/15 bg-slate-950/35 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
              Outliers Mobil Login CSV Migrate
            </p>
            <p className="text-[11px] text-cyan-100/75">
              `outliers_katilimci.csv` dosyasını `mobile_allowed_participants` tablosuna aktarır.
            </p>
            <p className="text-[11px] text-cyan-100/65">
              Güvenlik için sadece e-posta + telefon baz alınır. Ad soyad kolonunun dolu olması zorunlu değildir.
            </p>
            <p className="text-[11px] text-cyan-100/65">
              Telefon için önerilen format: <span className="font-semibold text-cyan-100">5XXXXXXXXX</span>.
              <span> </span>
              `+90XXXXXXXXXX`, `90XXXXXXXXXX` ve `0XXXXXXXXXX` değerleri otomatik olarak `5XXXXXXXXX`
              formatına normalize edilir.
            </p>

            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(event) => {
                  void handleOutliersCsvFileChange(event);
                }}
                className="block w-full cursor-pointer rounded-lg border border-cyan-200/25 bg-slate-900/40 px-2 py-2 text-xs text-slate-200 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-50 hover:file:bg-cyan-500/30"
              />
              {outliersCsvFileName ? (
                <p className="text-[11px] text-cyan-100/75">Seçilen dosya: {outliersCsvFileName}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-8 px-3 text-xs"
                  onClick={() => void migrateOutliersCsv()}
                  disabled={outliersImportState === "loading"}
                >
                  {outliersImportState === "loading" ? (
                    <>
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      Migrate...
                    </>
                  ) : (
                    "CSV'den migrate et"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 border-cyan-200/30 bg-cyan-200/10 px-3 text-xs text-cyan-50 hover:bg-cyan-200/20"
                  onClick={() => void migrateProjectOutliersCsv()}
                  disabled={outliersImportState === "loading"}
                >
                  Projedeki outliers_katilimci.csv
                </Button>
              </div>
            </div>

            {outliersImportMessage ? (
              <p
                className={`text-[11px] ${
                  outliersImportState === "error" ? "text-rose-300" : "text-emerald-200"
                }`}
              >
                {outliersImportMessage}
              </p>
            ) : null}

            {outliersImportDetail?.sample_rows && outliersImportDetail.sample_rows.length > 0 ? (
              <div className="rounded-lg border border-cyan-200/15 bg-slate-900/45 p-2">
                <p className="text-[11px] font-medium text-cyan-100/85">Örnek Satırlar</p>
                <div className="mt-1 space-y-1 text-[11px] text-slate-200/85">
                  {outliersImportDetail.sample_rows.slice(0, 4).map((row) => (
                    <p key={`${row.email}-${row.phone}`}>
                      {row.full_name} • {row.email} • {row.phone} • {row.status}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {outliersImportDetail?.invalid_lines && outliersImportDetail.invalid_lines.length > 0 ? (
              <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-2">
                <p className="text-[11px] font-medium text-rose-100">Geçersiz Satırlar</p>
                <div className="mt-1 space-y-1 text-[11px] text-rose-200/90">
                  {outliersImportDetail.invalid_lines.slice(0, 3).map((line) => (
                    <p key={`invalid-${line.line}`}>
                      Satır {line.line}: {line.reason}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              type="text"
              value={participantSearchDraft}
              onChange={(event) => setParticipantSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setParticipantSearchValue(participantSearchDraft.trim());
                }
              }}
              className="h-9 w-full rounded-lg border border-cyan-200/25 bg-slate-900/40 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-cyan-300"
              placeholder="Ad, kod veya referans ara"
            />
            <Button
              type="button"
              variant="outline"
              className="h-9 border-cyan-200/30 bg-cyan-200/10 px-3 text-cyan-50 hover:bg-cyan-200/20"
              onClick={() => setParticipantSearchValue(participantSearchDraft.trim())}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {participantsMessage ? (
            <p className={`mt-2 text-xs ${participantsMessage.includes("eklendi") ? "text-emerald-200" : "text-rose-300"}`}>
              {participantsMessage}
            </p>
          ) : null}

          <div className="mt-3 max-h-[295px] space-y-2 overflow-y-auto pr-1">
            {participantsLoading ? <p className="text-xs text-slate-300">Katılımcılar yükleniyor...</p> : null}
            {participants.slice(0, 40).map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-cyan-200/15 bg-slate-950/45 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">{participant.full_name}</p>
                  <p className="truncate text-xs text-cyan-100/70">
                    {participant.participant_code ?? "Kodsuz"} • {participant.external_ref ?? "Referans yok"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 border-cyan-200/30 bg-cyan-200/10 px-3 text-cyan-50 hover:bg-cyan-200/20"
                  onClick={() => void toggleParticipant(participant.id, participant.is_active)}
                  disabled={participantActionId === participant.id}
                >
                  {participantActionId === participant.id ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : participant.is_active ? (
                    <ToggleRight className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-slate-300" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-200/15 bg-slate-900/25 p-4">
          <div className="mb-3 flex items-center gap-2 text-cyan-100">
            <Images className="h-4 w-4" />
            <h4 className="text-sm font-semibold">Galeri Operasyonu</h4>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-cyan-200/20 bg-cyan-200/5 px-2 py-2 text-center">
              <p className="text-base font-semibold text-white">{galleryStats.total}</p>
              <p className="text-[10px] uppercase tracking-wide text-cyan-200/75">Toplam</p>
            </div>
            <div className="rounded-lg border border-cyan-200/20 bg-cyan-200/5 px-2 py-2 text-center">
              <p className="text-base font-semibold text-white">{galleryStats.photos}</p>
              <p className="text-[10px] uppercase tracking-wide text-cyan-200/75">Foto</p>
            </div>
            <div className="rounded-lg border border-cyan-200/20 bg-cyan-200/5 px-2 py-2 text-center">
              <p className="text-base font-semibold text-white">{galleryStats.videos}</p>
              <p className="text-[10px] uppercase tracking-wide text-cyan-200/75">Video</p>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-2 py-2 text-center">
              <p className="text-base font-semibold text-emerald-100">{galleryStats.synced}</p>
              <p className="text-[10px] uppercase tracking-wide text-emerald-200/80">Drive OK</p>
            </div>
            <div className="rounded-lg border border-rose-300/25 bg-rose-500/10 px-2 py-2 text-center">
              <p className="text-base font-semibold text-rose-100">{galleryStats.failed}</p>
              <p className="text-[10px] uppercase tracking-wide text-rose-200/80">Drive Hata</p>
            </div>
          </div>

          {galleryMessage ? <p className="mt-2 text-xs text-rose-200">{galleryMessage}</p> : null}

          <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">
            {galleryLoading ? <p className="text-xs text-slate-300">Galeri verisi yükleniyor...</p> : null}
            {galleryItems.slice(0, 24).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-cyan-200/15 bg-slate-950/45 p-2.5"
              >
                <div className="flex gap-2">
                  <div className="h-16 w-16 overflow-hidden rounded-lg bg-slate-800/70">
                    {item.media_type === "photo" ? (
                      <img
                        src={item.public_url}
                        alt={item.caption ?? "Galeri fotoğrafı"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <video
                        src={item.public_url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm text-slate-100">{item.uploader_name}</p>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${getBackupBadgeClass(item.drive_backup_status)}`}
                      >
                        {getBackupLabel(item.drive_backup_status)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-cyan-100/70">
                      {item.caption || "Açıklama yok"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-300">
                      {formatDate(item.created_at)} • {formatFileSize(item.file_size)}
                    </p>
                  </div>
                </div>

                {item.drive_backup_status === "failed" && item.drive_error ? (
                  <p className="mt-2 text-[11px] text-rose-200">{item.drive_error}</p>
                ) : null}

                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 border-rose-300/35 bg-rose-500/10 px-3 text-xs text-rose-100 hover:bg-rose-500/20"
                    onClick={() => void deleteGalleryItem(item.id)}
                    disabled={galleryActionId === item.id}
                  >
                    {galleryActionId === item.id ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Sil
                  </Button>
                </div>
              </div>
            ))}
            {!galleryLoading && galleryItems.length === 0 ? (
              <p className="text-xs text-slate-400">Henüz galeriye medya yüklenmedi.</p>
            ) : null}
          </div>
        </section>
      </div>
    </article>
  );
}
