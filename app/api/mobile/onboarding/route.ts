import { NextRequest, NextResponse } from "next/server";
import { resolveMobileSession } from "@/lib/mobile/auth";
import type { AttendeeRole } from "@/lib/types";
import type { Attendee } from "@/lib/types";
import { ensureNetworkingProfileForSession } from "@/lib/mobile/networking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OnboardingBody = {
  name?: string;
  role?: AttendeeRole;
  instagram?: string;
  linkedin?: string;
  outlier_score?: number;
};

const ALLOWED_ROLES: AttendeeRole[] = [
  "Student",
  "Clinician",
  "Academic",
  "Entrepreneur",
  "Industry"
];

function normalizeSocial(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  const instagram = normalizeSocial(body.instagram);
  const linkedin = normalizeSocial(body.linkedin);
  const outlierScore = Number.isFinite(Number(body.outlier_score)) ? Number(body.outlier_score) : 0;

  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "Ad soyad 2-120 karakter aralığında olmalı." }, { status: 400 });
  }
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Geçerli bir rol seçilmelidir." }, { status: 400 });
  }
  if (outlierScore < 0 || outlierScore > 100) {
    return NextResponse.json({ error: "Outlier puanı 0-100 aralığında olmalı." }, { status: 400 });
  }

  const supabase = resolved.session.supabase;
  const basePayload = {
    auth_user_id: resolved.session.authUserId,
    name,
    role,
    instagram,
    linkedin,
    outlier_score: Math.round(outlierScore)
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
    const networkingProfile = await ensureNetworkingProfileForSession({
      ...resolved.session,
      attendee
    });

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
    const attendee = existingByAuth as Attendee;
    const networkingProfile = await ensureNetworkingProfileForSession({
      ...resolved.session,
      attendee
    });

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
  const networkingProfile = await ensureNetworkingProfileForSession({
    ...resolved.session,
    attendee
  });

  return NextResponse.json({
    ok: true,
    attendee,
    networkingProfileId: networkingProfile?.id ?? null
  });
}
