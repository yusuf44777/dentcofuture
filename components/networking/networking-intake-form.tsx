"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Instagram,
  Linkedin,
  LoaderCircle,
  Search,
  Stethoscope,
  Users
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AppPageSwitcher } from "@/components/navigation/app-page-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildContactInfo, parseContactInfo } from "@/lib/networking-contact";

const INTEREST_OPTIONS = [
  "Ortodonti",
  "Periodontoloji",
  "Endodonti",
  "Pedodonti (Çocuk Diş Hekimliği)",
  "Ağız, Diş ve Çene Cerrahisi",
  "Protetik Diş Tedavisi",
  "Restoratif Diş Tedavisi",
  "Oral Diagnoz ve Radyoloji"
] as const;

const FUTURE_PATH_OPTIONS = [
  "DUS",
  "Kamu",
  "Klinik"
] as const;

type SubmitState = "idle" | "loading" | "error";
const NETWORKING_PROFILE_STORAGE_KEY = "dentco_networking_profile_id";

type UpdateProfileApiResponse = {
  ok?: boolean;
  id?: string;
  error?: string;
};

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function NetworkingIntakeForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [interestArea, setInterestArea] = useState("");
  const [futurePath, setFuturePath] = useState("");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [savedProfileId, setSavedProfileId] = useState("");
  const [isLoadingSavedProfile, setIsLoadingSavedProfile] = useState(true);
  const [savedProfileMessage, setSavedProfileMessage] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadSavedProfile = async () => {
      const savedId = localStorage.getItem(NETWORKING_PROFILE_STORAGE_KEY)?.trim() ?? "";
      if (!isValidUuid(savedId)) {
        if (isMounted) {
          setIsLoadingSavedProfile(false);
        }
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("networking_profiles")
          .select("id, full_name, interest_area, goal, contact_info")
          .eq("id", savedId)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        if (!data) {
          localStorage.removeItem(NETWORKING_PROFILE_STORAGE_KEY);
          if (isMounted) {
            setSavedProfileId("");
            setSavedProfileMessage("");
          }
          return;
        }

        if (!isMounted) {
          return;
        }

        const social = parseContactInfo(data.contact_info);
        setSavedProfileId(data.id);
        setFullName(data.full_name);
        setInterestArea(data.interest_area);
        setFuturePath(data.goal);
        setInstagram(social.instagram);
        setLinkedin(social.linkedin);
        setSavedProfileMessage("Kayıtlı profiliniz yüklendi. Düzenleyip güncelleyebilirsiniz.");
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setSavedProfileMessage("");
        setErrorMessage(
          error instanceof Error ? error.message : "Kayıtlı profil yüklenirken bir hata oluştu."
        );
      } finally {
        if (isMounted) {
          setIsLoadingSavedProfile(false);
        }
      }
    };

    void loadSavedProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const canSubmit = useMemo(
    () =>
      !isLoadingSavedProfile &&
      submitState !== "loading" &&
      fullName.trim().length > 1 &&
      Boolean(interestArea) &&
      Boolean(futurePath),
    [fullName, futurePath, interestArea, isLoadingSavedProfile, submitState]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setSubmitState("loading");
    setErrorMessage("");

    try {
      let targetProfileId = "";

      if (isValidUuid(savedProfileId)) {
        const updateResponse = await fetch("/api/networking/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId: savedProfileId,
            fullName: fullName.trim(),
            interestArea,
            goal: futurePath,
            instagram,
            linkedin
          })
        });

        const updatePayload = (await updateResponse.json().catch(() => null)) as
          | UpdateProfileApiResponse
          | null;

        if (!updateResponse.ok) {
          throw new Error(updatePayload?.error ?? "Profil güncellenemedi.");
        }

        targetProfileId = updatePayload?.id ?? savedProfileId;
      } else {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("networking_profiles")
          .insert({
            full_name: fullName.trim(),
            interest_area: interestArea,
            goal: futurePath,
            contact_info: buildContactInfo(instagram, linkedin)
          })
          .select("id")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!data?.id) {
          throw new Error("Profil kimliği oluşturulamadı.");
        }

        targetProfileId = data.id;
        setSavedProfileId(data.id);
      }

      localStorage.setItem(NETWORKING_PROFILE_STORAGE_KEY, targetProfileId);
      router.push(`/networking/waiting-room?id=${targetProfileId}`);
    } catch (error) {
      setSubmitState("error");
      setErrorMessage(error instanceof Error ? error.message : "Eşleşme kaydı sırasında bir hata oluştu.");
    }
  };

  return (
    <main className="min-h-screen px-4 py-6">
      <section className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <Image
            src="https://i.imgur.com/Q3ASL2i.png"
            alt="Dent Co Future logosu"
            width={210}
            height={92}
            priority
            className="h-auto w-[148px] object-contain sm:w-[176px]"
          />
          <Badge className="bg-cyan-50 text-cyan-800">COMMUNITIVE DENTISTRY</Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Kahve Molası Networking
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Bu ekran bir tanışma uygulaması değil, kongre içi profesyonel networking içindir.
            </p>
          </div>
        </div>

        <AppPageSwitcher />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-cyan-700" />
              Networking Kartı
            </CardTitle>
            <CardDescription>Benzer ilgi alanındaki katılımcı listesini hemen görün.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isLoadingSavedProfile ? (
                <p className="flex items-center gap-1 text-xs font-medium text-cyan-700">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Kayıtlı profil kontrol ediliyor...
                </p>
              ) : null}

              {savedProfileMessage ? (
                <p className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                  {savedProfileMessage}
                </p>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor="full-name" className="text-sm font-medium text-slate-700">
                  Ad Soyad
                </label>
                <input
                  id="full-name"
                  name="full-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value.slice(0, 120))}
                  placeholder="Örn: Ece Yılmaz"
                  required
                  autoComplete="name"
                  className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-800 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="interest-area" className="text-sm font-medium text-slate-700">
                  En Çok İlgilendiğiniz Alan
                </label>
                <select
                  id="interest-area"
                  name="interest-area"
                  value={interestArea}
                  onChange={(event) => setInterestArea(event.target.value)}
                  required
                  className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-800 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <option value="">Alan seçin</option>
                  {INTEREST_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="future-path" className="text-sm font-medium text-slate-700">
                  İleride Diş Hekimliğinde Neye Devam Etmek İstiyorsunuz?
                </label>
                <select
                  id="future-path"
                  name="future-path"
                  value={futurePath}
                  onChange={(event) => setFuturePath(event.target.value)}
                  required
                  className="h-11 w-full rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-800 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <option value="">Bir yol seçin</option>
                  {FUTURE_PATH_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Sosyal Medya (Opsiyonel)
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-cyan-100 bg-white px-3">
                    <Instagram className="h-4 w-4 text-pink-600" />
                    <input
                      id="instagram"
                      name="instagram"
                      value={instagram}
                      onChange={(event) => setInstagram(event.target.value)}
                      placeholder="@kullaniciadi veya instagram.com/..."
                      className="h-11 w-full bg-transparent text-sm text-slate-800 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-cyan-100 bg-white px-3">
                    <Linkedin className="h-4 w-4 text-sky-700" />
                    <input
                      id="linkedin"
                      name="linkedin"
                      value={linkedin}
                      onChange={(event) => setLinkedin(event.target.value)}
                      placeholder="linkedin.com/in/... veya profil adı"
                      className="h-11 w-full bg-transparent text-sm text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
                {submitState === "loading" ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Profil kaydediliyor...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    {isValidUuid(savedProfileId) ? "Profili Güncelle ve Listeye Dön" : "Benzer Profilleri Göster"}
                  </>
                )}
              </Button>

              {submitState === "error" && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMessage}
                </p>
              )}

              {submitState === "loading" ? (
                <p className="flex items-center gap-1 text-xs font-medium text-cyan-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Profiliniz kaydediliyor, liste hazırlanıyor...
                </p>
              ) : null}

              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Users className="h-4 w-4" />
                Listede ad-soyad, mesleki alan ve paylaşılan sosyal medya bilgisi gösterilir.
              </p>

              <p className="text-xs text-cyan-700">
                Profiliniz bu cihazda saklanır, sayfa yenilense bile kaybolmaz.
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
