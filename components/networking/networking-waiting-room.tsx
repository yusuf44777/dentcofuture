"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Instagram,
  Linkedin,
  LoaderCircle,
  RefreshCw,
  Timer,
  UserRound,
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getInstagramDisplay,
  getInstagramProfileUrl,
  getLinkedinDisplay,
  getLinkedinProfileUrl,
  parseContactInfo
} from "@/lib/networking-contact";
import { AppPageSwitcher } from "@/components/navigation/app-page-switcher";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { NetworkingProfileRow } from "@/lib/types";

const REFRESH_INTERVAL_MS = 12000;
const NETWORKING_PROFILE_STORAGE_KEY = "dentco_networking_profile_id";

type ViewState = "loading" | "ready" | "empty" | "error";

type PublicProfile = Pick<
  NetworkingProfileRow,
  "id" | "full_name" | "interest_area" | "goal" | "contact_info" | "created_at"
>;

type SimilarProfilesResponse = {
  status?: "found" | "waiting";
  currentProfile?: PublicProfile | null;
  similarProfiles?: PublicProfile[];
  message?: string;
  error?: string;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

interface NetworkingWaitingRoomProps {
  profileId: string;
}

export function NetworkingWaitingRoom({ profileId }: NetworkingWaitingRoomProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [resolvedProfileId, setResolvedProfileId] = useState(profileId.trim());
  const [resolvingProfileId, setResolvingProfileId] = useState(true);

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState(
    "Etrafınızdaki benzer profiller listeleniyor..."
  );
  const [currentProfile, setCurrentProfile] = useState<PublicProfile | null>(null);
  const [similarProfiles, setSimilarProfiles] = useState<PublicProfile[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const viewStateRef = useRef<ViewState>("loading");
  const currentInterestRef = useRef<string>("");
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

  useEffect(() => {
    const queryId = profileId.trim();
    const savedId = localStorage.getItem(NETWORKING_PROFILE_STORAGE_KEY)?.trim() ?? "";

    if (isValidUuid(queryId)) {
      localStorage.setItem(NETWORKING_PROFILE_STORAGE_KEY, queryId);
      setResolvedProfileId(queryId);
      setResolvingProfileId(false);
      return;
    }

    if (isValidUuid(savedId)) {
      setResolvedProfileId(savedId);
      setResolvingProfileId(false);
      router.replace(`/networking/waiting-room?id=${savedId}`);
      return;
    }

    setResolvedProfileId("");
    setResolvingProfileId(false);
  }, [profileId, router]);

  const fetchSimilarProfiles = useCallback(async () => {
    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;

    try {
      const response = await fetch("/api/networking/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: resolvedProfileId })
      });

      const payload = (await response.json()) as SimilarProfilesResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Profil servisi yanıt vermedi.");
      }

      if (payload.currentProfile) {
        currentInterestRef.current = payload.currentProfile.interest_area;
        setCurrentProfile(payload.currentProfile);
      }

      const nextProfiles = payload.similarProfiles ?? [];
      setSimilarProfiles(nextProfiles);
      setViewState(nextProfiles.length > 0 ? "ready" : "empty");

      if (payload.message) {
        setInfoMessage(payload.message);
      }
    } catch (error) {
      setViewState("error");
      setErrorMessage(error instanceof Error ? error.message : "Benzer profiller alınamadı.");
    } finally {
      requestInFlightRef.current = false;
    }
  }, [resolvedProfileId]);

  useEffect(() => {
    if (resolvingProfileId) {
      return;
    }

    if (!isValidUuid(resolvedProfileId)) {
      setViewState("error");
      setErrorMessage("Kayıtlı profil bulunamadı. Lütfen formu yeniden doldurun.");
      return;
    }

    let isMounted = true;
    const startedAt = Date.now();

    setViewState("loading");
    void fetchSimilarProfiles();

    const channel = supabase
      .channel(`networking-directory-${resolvedProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "networking_profiles",
        },
        (payload) => {
          if (!isMounted) {
            return;
          }
          const nextRow = payload.new as NetworkingProfileRow;
          if (!currentInterestRef.current) {
            return;
          }
          if (nextRow.id !== resolvedProfileId && nextRow.interest_area === currentInterestRef.current) {
            void fetchSimilarProfiles();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "networking_profiles"
        },
        (payload) => {
          if (!isMounted) {
            return;
          }
          const nextRow = payload.new as NetworkingProfileRow;
          if (nextRow.id === resolvedProfileId) {
            void fetchSimilarProfiles();
            return;
          }

          if (!currentInterestRef.current) {
            return;
          }
          if (nextRow.interest_area === currentInterestRef.current) {
            void fetchSimilarProfiles();
          }
        }
      )
      .subscribe();

    const elapsedInterval = window.setInterval(() => {
      if (!isMounted) {
        return;
      }
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    const refreshInterval = window.setInterval(() => {
      if (!isMounted || viewStateRef.current === "error") {
        return;
      }
      void fetchSimilarProfiles();
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(elapsedInterval);
      window.clearInterval(refreshInterval);
      void supabase.removeChannel(channel);
    };
  }, [fetchSimilarProfiles, resolvedProfileId, resolvingProfileId, supabase]);

  return (
    <main className="min-h-screen px-4 py-8">
      <section className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div className="text-center">
          <Badge className="bg-cyan-50 text-cyan-800">COMMUNITIVE DENTISTRY • Networking</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Yakınınızdaki Benzer Profiller
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Bu alan yalnızca kongre içi profesyonel iletişim için hazırlanmıştır.
          </p>
        </div>

        <AppPageSwitcher showSavedProfileButton={false} />

        {currentProfile ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-cyan-700" />
                Profiliniz
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">{currentProfile.full_name}</p>
              <p className="text-sm text-slate-600">İlgi Alanı: {currentProfile.interest_area}</p>
              <p className="text-sm text-slate-600">Kariyer Yönü: {currentProfile.goal}</p>
              {(() => {
                const social = parseContactInfo(currentProfile.contact_info);
                const instagramUrl = getInstagramProfileUrl(social.instagram);
                const instagramLabel = getInstagramDisplay(social.instagram);
                const linkedinUrl = getLinkedinProfileUrl(social.linkedin);
                const linkedinLabel = getLinkedinDisplay(social.linkedin);

                if (!social.instagram && !social.linkedin) {
                  return null;
                }

                return (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {instagramUrl && instagramLabel ? (
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-pink-200 bg-pink-50 px-2.5 py-1 text-xs font-medium text-pink-700"
                      >
                        <Instagram className="h-3.5 w-3.5" />
                        {instagramLabel}
                      </a>
                    ) : null}
                    {linkedinUrl && linkedinLabel ? (
                      <a
                        href={linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
                      >
                        <Linkedin className="h-3.5 w-3.5" />
                        {linkedinLabel}
                      </a>
                    ) : null}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-700" />
              Benzer Katılımcılar
            </CardTitle>
            <CardDescription>{infoMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resolvingProfileId ? (
              <div className="flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3 py-3 text-sm text-cyan-800">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Kayıtlı profil kontrol ediliyor...
              </div>
            ) : null}

            <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
              <Timer className="h-4 w-4" />
              Güncelleme süresi: {elapsedSeconds} saniye
            </p>

            {viewState === "loading" ? (
              <div className="flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3 py-3 text-sm text-cyan-800">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Benzer profiller yükleniyor...
              </div>
            ) : null}

            {viewState === "error" ? (
              <>
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMessage}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setViewState("loading");
                    setErrorMessage("");
                    void fetchSimilarProfiles();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Tekrar Yükle
                </Button>
              </>
            ) : null}

            {viewState === "empty" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                Şu an aynı ilgi alanında profil bulunamadı. Liste otomatik yenilenmeye devam ediyor.
              </div>
            ) : null}

            {viewState === "ready" ? (
              <div className="space-y-2">
                {similarProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="rounded-xl border border-cyan-100 bg-white px-3 py-3 transition hover:bg-cyan-50/50"
                  >
                    <p className="text-sm font-semibold text-slate-900">{profile.full_name}</p>
                    <p className="text-xs text-slate-600">İlgi Alanı: {profile.interest_area}</p>
                    <p className="text-xs text-slate-600">Kariyer Yönü: {profile.goal}</p>
                    {(() => {
                      const social = parseContactInfo(profile.contact_info);
                      const instagramUrl = getInstagramProfileUrl(social.instagram);
                      const instagramLabel = getInstagramDisplay(social.instagram);
                      const linkedinUrl = getLinkedinProfileUrl(social.linkedin);
                      const linkedinLabel = getLinkedinDisplay(social.linkedin);

                      if (!social.instagram && !social.linkedin) {
                        return null;
                      }

                      return (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {instagramUrl && instagramLabel ? (
                            <a
                              href={instagramUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-pink-200 bg-pink-50 px-2.5 py-1 text-[11px] font-medium text-pink-700"
                            >
                              <Instagram className="h-3.5 w-3.5" />
                              {instagramLabel}
                            </a>
                          ) : null}
                          {linkedinUrl && linkedinLabel ? (
                            <a
                              href={linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700"
                            >
                              <Linkedin className="h-3.5 w-3.5" />
                              {linkedinLabel}
                            </a>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            ) : null}

            {(viewState === "ready" || viewState === "empty") && (
              <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Gerçek zamanlı listeleme aktif
              </p>
            )}

            <Link href="/networking" className="block">
              <Button variant="outline" className="w-full">
                Profili Güncelle
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
