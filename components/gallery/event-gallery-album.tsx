"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Images, LoaderCircle, RefreshCw, UploadCloud } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

type GalleryMediaType = "photo" | "video";
type GalleryBackupStatus = "pending" | "synced" | "failed" | "disabled";

type GalleryItem = {
  id: string;
  uploader_name: string;
  caption: string | null;
  media_type: GalleryMediaType;
  mime_type: string;
  file_path: string;
  public_url: string;
  file_size: number;
  drive_backup_status: GalleryBackupStatus;
  drive_file_id: string | null;
  drive_error: string | null;
  created_at: string;
};

type UploadSessionResponse = {
  ok?: boolean;
  upload?: {
    path: string;
    token: string;
  };
  normalized?: {
    uploaderName: string;
    caption: string;
    mimeType: string;
    fileSize: number;
    mediaType: GalleryMediaType;
  };
  error?: string;
};

type FinalizeResponse = {
  ok?: boolean;
  item?: GalleryItem;
  backup?: {
    status: GalleryBackupStatus;
    message?: string;
  };
  error?: string;
};

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

function getStatusLabel(status: GalleryBackupStatus) {
  switch (status) {
    case "synced":
      return "Drive ✓";
    case "failed":
      return "Drive ✗";
    case "disabled":
      return "Drive —";
    default:
      return "Bekliyor";
  }
}

function getStatusClassName(status: GalleryBackupStatus) {
  if (status === "synced") {
    return "bg-[rgba(0,229,160,0.12)] text-[#00E5A0] border border-[rgba(0,229,160,0.2)]";
  }
  if (status === "failed") {
    return "bg-[rgba(255,77,109,0.12)] text-[#FF4D6D] border border-[rgba(255,77,109,0.2)]";
  }

  return "bg-[rgba(123,110,255,0.1)] text-[rgba(180,170,255,0.6)] border border-[rgba(123,110,255,0.15)]";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function EventGalleryAlbum() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | GalleryMediaType>("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploaderName, setUploaderName] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const filteredItems = useMemo(() => {
    if (filter === "all") {
      return items;
    }
    return items.filter((item) => item.media_type === filter);
  }, [filter, items]);

  const loadItems = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "80");
      if (filter !== "all") {
        params.set("type", filter);
      }

      const response = await fetch(`/api/gallery?${params.toString()}`, {
        method: "GET",
        cache: "no-store"
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; items?: GalleryItem[]; error?: string }
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Galeri alınamadı.");
      }

      setItems(data.items ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Galeri alınamadı."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleUpload = async () => {
    if (uploading) {
      return;
    }

    if (uploaderName.trim().length < 2) {
      setError("Ad soyad en az 2 karakter olmalıdır.");
      return;
    }

    if (selectedFiles.length === 0) {
      setError("Lütfen en az bir fotoğraf veya video seçin.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    setUploadProgress("");

    const sb = createSupabaseBrowserClient();
    let successCount = 0;
    const uploadErrors: string[] = [];

    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index]!;
        setUploadProgress(`${index + 1}/${selectedFiles.length} yükleniyor: ${file.name}`);

        const sessionResponse = await fetch("/api/gallery/upload-session", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            uploaderName,
            caption
          })
        });
        const sessionData = (await sessionResponse.json().catch(() => null)) as UploadSessionResponse | null;

        if (!sessionResponse.ok || !sessionData?.ok || !sessionData.upload || !sessionData.normalized) {
          throw new Error(sessionData?.error ?? `${file.name} için yükleme oturumu oluşturulamadı.`);
        }

        const uploadResult = await sb.storage
          .from("event-gallery")
          .uploadToSignedUrl(sessionData.upload.path, sessionData.upload.token, file);
        if (uploadResult.error) {
          throw new Error(`${file.name} yüklenemedi: ${uploadResult.error.message}`);
        }

        const finalizeResponse = await fetch("/api/gallery/finalize", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            path: sessionData.upload.path,
            mimeType: sessionData.normalized.mimeType,
            fileSize: sessionData.normalized.fileSize,
            uploaderName: sessionData.normalized.uploaderName,
            caption: sessionData.normalized.caption
          })
        });
        const finalizeData = (await finalizeResponse.json().catch(() => null)) as FinalizeResponse | null;

        if (!finalizeResponse.ok || !finalizeData?.ok || !finalizeData.item) {
          throw new Error(finalizeData?.error ?? `${file.name} galeriye kaydedilemedi.`);
        }

        successCount += 1;
      }

      setMessage(`${successCount} medya albüme eklendi.`);
      setSelectedFiles([]);
      setCaption("");
      await loadItems();
    } catch (uploadError) {
      uploadErrors.push(getErrorMessage(uploadError, "Yükleme sırasında hata oluştu."));
    } finally {
      setUploading(false);
      setUploadProgress("");
    }

    if (uploadErrors.length > 0) {
      setError(uploadErrors.join(" "));
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <section className="card-glass rounded-2xl p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(123,110,255,0.15)]">
            <UploadCloud className="h-4 w-4 text-[#7B6EFF]" />
          </div>
          <h2 className="font-heading text-base font-bold tracking-tight">Albüme Ekle</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgba(180,170,255,0.5)]">
              Ad Soyad
            </label>
            <input
              type="text"
              placeholder="Adınız Soyadınız"
              value={uploaderName}
              onChange={(event) => setUploaderName(event.target.value)}
              className="h-11 w-full rounded-xl border border-[rgba(123,110,255,0.18)] bg-[rgba(12,16,48,0.7)] px-3 text-sm text-white placeholder:text-[rgba(180,170,255,0.3)] outline-none transition focus:border-[rgba(123,110,255,0.5)] focus:bg-[rgba(12,16,48,0.9)]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgba(180,170,255,0.5)]">
              Fotoğraf / Video
            </label>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
              className="block h-11 w-full rounded-xl border border-[rgba(123,110,255,0.18)] bg-[rgba(12,16,48,0.7)] px-3 py-2 text-sm text-[rgba(200,195,255,0.7)] file:mr-3 file:rounded-lg file:border-0 file:bg-[rgba(123,110,255,0.2)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#B8ACFF] hover:border-[rgba(123,110,255,0.35)] outline-none cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgba(180,170,255,0.5)]">
            Açıklama (opsiyonel)
          </label>
          <textarea
            placeholder="Bu kareyi kısa bir notla paylaşabilirsiniz…"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={2}
            className="w-full rounded-xl border border-[rgba(123,110,255,0.18)] bg-[rgba(12,16,48,0.7)] px-3 py-2.5 text-sm text-white placeholder:text-[rgba(180,170,255,0.3)] outline-none transition focus:border-[rgba(123,110,255,0.5)] resize-none"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleUpload} disabled={uploading}>
            {uploading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Yükleniyor...
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Albüme Yükle
              </>
            )}
          </Button>
          <p className="text-xs text-[rgba(180,170,255,0.35)]">
            {selectedFiles.length > 0 ? `${selectedFiles.length} dosya seçildi` : "Dosya seçilmedi"}
          </p>
          {uploadProgress ? <p className="text-xs text-[#7B6EFF]">{uploadProgress}</p> : null}
        </div>

        {message ? <p className="mt-2 text-sm text-[#00E5A0]">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-[#FF4D6D]">{error}</p> : null}
      </section>

      {/* Gallery grid */}
      <section className="card-glass rounded-2xl p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(123,110,255,0.15)]">
              <Images className="h-4 w-4 text-[#7B6EFF]" />
            </div>
            <h2 className="font-heading text-base font-bold tracking-tight">Etkinlik Galerisi</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "photo", "video"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`h-8 rounded-full px-4 text-xs font-semibold transition-all ${
                  filter === f
                    ? "bg-[#7B6EFF] text-white"
                    : "border border-[rgba(123,110,255,0.2)] text-[rgba(180,170,255,0.55)] hover:border-[rgba(123,110,255,0.4)] hover:text-white"
                }`}
              >
                {f === "all" ? "Tümü" : f === "photo" ? "Fotoğraf" : "Video"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadItems()}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(123,110,255,0.2)] text-[rgba(180,170,255,0.4)] transition hover:border-[rgba(123,110,255,0.4)] hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[rgba(180,170,255,0.4)]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Galeri yükleniyor…
          </div>
        ) : null}

        {!loading && filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[rgba(123,110,255,0.2)] px-4 py-10 text-center text-sm text-[rgba(180,170,255,0.35)]">
            Henüz galeriye medya eklenmedi.
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="group overflow-hidden rounded-xl border border-[rgba(123,110,255,0.12)] bg-[rgba(12,16,48,0.7)] transition-all duration-200 hover:border-[rgba(123,110,255,0.3)] hover:shadow-purple"
            >
              <div className="relative aspect-[4/3] bg-[rgba(12,16,48,0.9)]">
                {item.media_type === "photo" ? (
                  <img
                    src={item.public_url}
                    alt={item.caption || "Etkinlik fotoğrafı"}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                ) : (
                  <video
                    src={item.public_url}
                    className="h-full w-full object-cover"
                    controls
                    preload="metadata"
                  />
                )}
              </div>

              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-white">{item.uploader_name}</p>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${getStatusClassName(item.drive_backup_status)}`}>
                    {getStatusLabel(item.drive_backup_status)}
                  </span>
                </div>
                {item.caption ? (
                  <p className="line-clamp-2 text-xs leading-relaxed text-[rgba(200,195,255,0.5)]">{item.caption}</p>
                ) : null}
                <div className="flex items-center justify-between text-[11px] text-[rgba(180,170,255,0.3)]">
                  <span>{formatDate(item.created_at)}</span>
                  <span>{formatFileSize(item.file_size)}</span>
                </div>
                {item.drive_backup_status === "failed" && item.drive_error ? (
                  <p className="text-[11px] text-[#FF4D6D]">{item.drive_error}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Info */}
      <section className="flex items-start gap-2.5 rounded-xl border border-[rgba(123,110,255,0.12)] bg-[rgba(12,16,48,0.4)] px-4 py-3 text-xs text-[rgba(180,170,255,0.35)]">
        <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7B6EFF]" />
        <p>Yüklenen medya dosyaları Google Drive yedeğiyle korunur ve etkinlik galerisinde herkesle paylaşılır.</p>
      </section>
    </div>
  );
}
