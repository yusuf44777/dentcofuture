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
      return "Drive yedeği tamam";
    case "failed":
      return "Drive yedeği hatalı";
    case "disabled":
      return "Drive yedeği pasif";
    default:
      return "Drive yedeği bekliyor";
  }
}

function getStatusClassName(status: GalleryBackupStatus) {
  if (status === "synced") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "failed") {
    return "bg-rose-100 text-rose-800";
  }
  if (status === "disabled") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-amber-100 text-amber-900";
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
      <section className="rounded-2xl border border-amber-100/70 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-amber-800">
          <UploadCloud className="h-5 w-5" />
          <h2 className="text-lg font-semibold tracking-tight">Etkinlik Albümüne Ekle</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Ad Soyad</label>
            <input
              type="text"
              placeholder="Adınız Soyadınız"
              value={uploaderName}
              onChange={(event) => setUploaderName(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-800">Fotoğraf / Video</label>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
              className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-amber-900 hover:border-amber-300"
            />
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Açıklama (Opsiyonel)</label>
          <textarea
            placeholder="Bu kareyi kısa bir notla paylaşabilirsiniz."
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
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
          <p className="text-xs text-slate-500">
            Seçilen dosya: {selectedFiles.length > 0 ? selectedFiles.length : 0}
          </p>
          {uploadProgress ? <p className="text-xs text-amber-700">{uploadProgress}</p> : null}
        </div>

        {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-900">
            <Images className="h-5 w-5 text-amber-700" />
            <h2 className="text-lg font-semibold tracking-tight">Etkinlik Galerisi</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={filter === "all" ? "default" : "outline"}
              className="h-9 px-3 text-xs"
              onClick={() => setFilter("all")}
            >
              Tümü
            </Button>
            <Button
              type="button"
              variant={filter === "photo" ? "default" : "outline"}
              className="h-9 px-3 text-xs"
              onClick={() => setFilter("photo")}
            >
              Fotoğraf
            </Button>
            <Button
              type="button"
              variant={filter === "video" ? "default" : "outline"}
              className="h-9 px-3 text-xs"
              onClick={() => setFilter("video")}
            >
              Video
            </Button>
            <Button type="button" variant="outline" className="h-9 px-3 text-xs" onClick={() => void loadItems()}>
              <RefreshCw className="h-4 w-4" />
              Yenile
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Galeri yükleniyor...
          </div>
        ) : null}

        {!loading && filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Henüz galeriye medya eklenmedi.
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
            >
              <div className="relative aspect-[4/3] bg-slate-200">
                {item.media_type === "photo" ? (
                  <img
                    src={item.public_url}
                    alt={item.caption || "Etkinlik fotoğrafı"}
                    className="h-full w-full object-cover"
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
                  <p className="truncate text-sm font-semibold text-slate-900">{item.uploader_name}</p>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${getStatusClassName(item.drive_backup_status)}`}
                  >
                    {getStatusLabel(item.drive_backup_status)}
                  </span>
                </div>
                {item.caption ? <p className="line-clamp-2 text-sm text-slate-700">{item.caption}</p> : null}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{formatDate(item.created_at)}</span>
                  <span>{formatFileSize(item.file_size)}</span>
                </div>
                {item.drive_backup_status === "failed" && item.drive_error ? (
                  <p className="text-xs text-rose-600">{item.drive_error}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
        <p className="flex items-center gap-2 font-medium">
          <Camera className="h-4 w-4" />
          Yüklenen medya dosyaları otomatik olarak Supabase üzerinde saklanır ve Google Drive&apos;a yedeklenir.
        </p>
      </section>
    </div>
  );
}
