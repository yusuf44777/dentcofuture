import { NextRequest, NextResponse } from "next/server";
import { resolveMobileSession } from "@/lib/mobile/auth";
import type { Attendee, AttendeeClassLevel, AttendeeRole } from "@/lib/types";
import { ensureNetworkingProfileForSession } from "@/lib/mobile/networking";
import { buildContactInfo } from "@/lib/networking-contact";
import { NETWORKING_INTEREST_OPTIONS } from "@/lib/networking/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OnboardingBody = {
  name?: string;
  role?: AttendeeRole;
  class_level?: AttendeeClassLevel | null;
  dentistry_interest_area?: string;
  university?: string;
  instagram?: string;
  linkedin?: string;
  outlier_score?: number;
};

const ALLOWED_ROLES: AttendeeRole[] = ["Student", "Academic"];
const ALLOWED_CLASS_LEVELS: AttendeeClassLevel[] = ["Hazırlık", "1", "2", "3", "4", "5", "Mezun"];
const ALLOWED_DENTISTRY_INTEREST_AREAS = NETWORKING_INTEREST_OPTIONS as readonly string[];

function normalizeSocial(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalField(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  const resolved = await resolveMobileSession(request);
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  let body: OnboardingBody = {};
  try {
    body = (await request.json()) as OnboardingBody;
  } catch {
    body = {};
  }

  const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
  const role = body.role;
  const rawClassLevel = typeof body.class_level === "string" ? body.class_level.trim() : "";
  const classLevel = ALLOWED_CLASS_LEVELS.includes(rawClassLevel as AttendeeClassLevel)
    ? (rawClassLevel as AttendeeClassLevel)
    : null;
  const rawDentistryInterestArea =
    typeof body.dentistry_interest_area === "string"
      ? body.dentistry_interest_area.replace(/\s+/g, " ").trim()
      : "";
  const dentistryInterestArea = ALLOWED_DENTISTRY_INTEREST_AREAS.includes(rawDentistryInterestArea)
    ? rawDentistryInterestArea
    : null;
  const university = normalizeOptionalField(body.university, 120);
  const instagram = normalizeSocial(body.instagram);
  const linkedin = normalizeSocial(body.linkedin);
  const outlierScore = Number.isFinite(Number(body.outlier_score)) ? Number(body.outlier_score) : 0;

  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "Ad soyad 2-120 karakter aralığında olmalı." }, { status: 400 });
  }
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Rol sadece Öğrenci veya Akademisyen olabilir." },
      { status: 400 }
    );
  }
  if (role === "Student" && !classLevel) {
    return NextResponse.json({ error: "Öğrenci için sınıf seçimi zorunludur." }, { status: 400 });
  }
  if (rawClassLevel.length > 0 && !classLevel) {
    return NextResponse.json({ error: "Geçersiz sınıf değeri gönderildi." }, { status: 400 });
  }
  if (rawDentistryInterestArea.length > 0 && !dentistryInterestArea) {
    return NextResponse.json({ error: "Geçersiz diş hekimliği alanı seçildi." }, { status: 400 });
  }
  if (!university || university.length < 2) {
    return NextResponse.json({ error: "Üniversite bilgisi zorunludur." }, { status: 400 });
  }
  if (outlierScore < 0 || outlierScore > 100) {
    return NextResponse.json({ error: "Outlier puanı 0-100 aralığında olmalı." }, { status: 400 });
  }

  const supabase = resolved.session.supabase;
  const basePayload = {
    auth_user_id: resolved.session.authUserId,
    name,
    role,
    class_level: role === "Student" ? classLevel : null,
    university,
    instagram,
    linkedin,
    outlier_score: Math.round(outlierScore)
  };

  const syncNetworkingProfile = async (attendee: Attendee) => {
    const networkingProfile = await ensureNetworkingProfileForSession({
      ...resolved.session,
      attendee
    });

    if (!networkingProfile?.id) {
      return networkingProfile;
    }

    const profilePayload: Record<string, unknown> = {
      full_name: attendee.name,
      headline: attendee.role,
      institution_name: university,
      contact_info: buildContactInfo(instagram ?? "", linkedin ?? ""),
      last_active_at: new Date().toISOString()
    };

    if (dentistryInterestArea) {
      profilePayload.interest_area = dentistryInterestArea;
    }

    const { error } = await supabase
      .from("networking_profiles")
      .update(profilePayload)
      .eq("id", networkingProfile.id);

    if (error) {
      throw new Error(`Networking profili güncellenemedi: ${error.message}`);
    }

    return networkingProfile;
  };

  if (resolved.session.attendee?.id) {
    const { data, error } = await supabase
      .from("attendees")
      .update(basePayload)
      .eq("id", resolved.session.attendee.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: `Profil güncellenemedi: ${error.message}` }, { status: 500 });
    }

    const attendee = data as Attendee;
    let networkingProfile = null;
    try {
      networkingProfile = await syncNetworkingProfile(attendee);
    } catch (networkingError) {
      const message =
        networkingError instanceof Error ? networkingError.message : "Networking profili güncellenemedi.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      attendee,
      networkingProfileId: networkingProfile?.id ?? null
    });
  }

  const { data: existingByAuth, error: existingByAuthError } = await supabase
    .from("attendees")
    .select("*")
    .eq("auth_user_id", resolved.session.authUserId)
    .maybeSingle();

  if (existingByAuthError) {
    return NextResponse.json({ error: `Profil sorgulanamadı: ${existingByAuthError.message}` }, { status: 500 });
  }

  if (existingByAuth) {
    const updateExistingResult = await supabase
      .from("attendees")
      .update(basePayload)
      .eq("id", existingByAuth.id)
      .select("*")
      .single();

    if (updateExistingResult.error || !updateExistingResult.data) {
      return NextResponse.json(
        { error: `Profil güncellenemedi: ${updateExistingResult.error?.message ?? "Bilinmeyen hata"}` },
        { status: 500 }
      );
    }

    const attendee = updateExistingResult.data as Attendee;
    let networkingProfile = null;
    try {
      networkingProfile = await syncNetworkingProfile(attendee);
    } catch (networkingError) {
      const message =
        networkingError instanceof Error ? networkingError.message : "Networking profili güncellenemedi.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      attendee,
      networkingProfileId: networkingProfile?.id ?? null
    });
  }

  const { data, error } = await supabase
    .from("attendees")
    .insert({
      ...basePayload,
      points: 80
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: `Profil oluşturulamadı: ${error.message}` }, { status: 500 });
  }

  const attendee = data as Attendee;
  let networkingProfile = null;
  try {
    networkingProfile = await syncNetworkingProfile(attendee);
  } catch (networkingError) {
    const message =
      networkingError instanceof Error ? networkingError.message : "Networking profili güncellenemedi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    attendee,
    networkingProfileId: networkingProfile?.id ?? null
  });
}
