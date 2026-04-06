import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateParticipantPayload = {
  fullName?: string;
  participantCode?: string;
  externalRef?: string;
  isActive?: boolean;
};

type UpdateParticipantPayload = {
  participantId?: string;
  fullName?: string;
  participantCode?: string;
  externalRef?: string;
  isActive?: boolean;
};

function getRaffleAdminSecret() {
  return process.env.RAFFLE_ADMIN_SECRET ?? "";
}

function isAuthorized(request: NextRequest) {
  return isModeratorRequestAuthorized(request, {
    secret: getRaffleAdminSecret(),
    secretHeaderName: "x-raffle-secret"
  });
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function clampLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.max(1, Math.min(500, Math.floor(parsed)));
}

function getErrorMessage(error: unknown, fallback = "Katılımcı listesi alınamadı.") {
  if (process.env.NODE_ENV === "production") {
    return fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const query = (searchParams.get("q") ?? "").trim();

  try {
    const supabase = createSupabaseAdminClient();
    let participantsQuery = supabase
      .from("raffle_participants")
      .select("id, full_name, participant_code, external_ref, is_active, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (query) {
      participantsQuery = participantsQuery.or(
        `full_name.ilike.%${query}%,participant_code.ilike.%${query}%,external_ref.ilike.%${query}%`
      );
    }

    const { data, error } = await participantsQuery;

    if (error) {
      throw new Error(`Katılımcı listesi alınamadı: ${error.message}`);
    }

    return NextResponse.json({
      participants: data ?? []
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Katılımcı listesi alınamadı.") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let payload: CreateParticipantPayload = {};
  try {
    payload = (await request.json()) as CreateParticipantPayload;
  } catch {
    payload = {};
  }

  const fullName = normalizeText(payload.fullName);
  const participantCode = normalizeText(payload.participantCode);
  const externalRef = normalizeText(payload.externalRef);
  const isActive = payload.isActive !== false;

  if (fullName.length < 2 || fullName.length > 120) {
    return NextResponse.json({ error: "Ad soyad 2-120 karakter aralığında olmalı." }, { status: 400 });
  }

  if (participantCode.length > 32) {
    return NextResponse.json({ error: "Katılımcı kodu en fazla 32 karakter olabilir." }, { status: 400 });
  }

  if (externalRef.length > 80) {
    return NextResponse.json({ error: "Dış referans en fazla 80 karakter olabilir." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("raffle_participants")
      .insert({
        full_name: fullName,
        participant_code: participantCode || undefined,
        external_ref: externalRef || null,
        is_active: isActive
      })
      .select("id, full_name, participant_code, external_ref, is_active, created_at, updated_at")
      .single();

    if (error) {
      throw new Error(`Katılımcı eklenemedi: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      participant: data
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Katılımcı eklenemedi.") },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let payload: UpdateParticipantPayload = {};
  try {
    payload = (await request.json()) as UpdateParticipantPayload;
  } catch {
    payload = {};
  }

  const participantId = normalizeText(payload.participantId);
  if (!isValidUuid(participantId)) {
    return NextResponse.json({ error: "Geçersiz katılımcı kimliği." }, { status: 400 });
  }

  const updates: {
    full_name?: string;
    participant_code?: string;
    external_ref?: string | null;
    is_active?: boolean;
  } = {};

  if (typeof payload.fullName === "string") {
    const fullName = normalizeText(payload.fullName);
    if (fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json({ error: "Ad soyad 2-120 karakter aralığında olmalı." }, { status: 400 });
    }
    updates.full_name = fullName;
  }

  if (typeof payload.participantCode === "string") {
    const participantCode = normalizeText(payload.participantCode);
    if (participantCode.length > 32) {
      return NextResponse.json({ error: "Katılımcı kodu en fazla 32 karakter olabilir." }, { status: 400 });
    }
    updates.participant_code = participantCode;
  }

  if (typeof payload.externalRef === "string") {
    const externalRef = normalizeText(payload.externalRef);
    if (externalRef.length > 80) {
      return NextResponse.json({ error: "Dış referans en fazla 80 karakter olabilir." }, { status: 400 });
    }
    updates.external_ref = externalRef.length > 0 ? externalRef : null;
  }

  if (typeof payload.isActive === "boolean") {
    updates.is_active = payload.isActive;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan bulunamadı." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("raffle_participants")
      .update(updates)
      .eq("id", participantId)
      .select("id, full_name, participant_code, external_ref, is_active, created_at, updated_at")
      .maybeSingle();

    if (error) {
      throw new Error(`Katılımcı güncellenemedi: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json({ error: "Katılımcı bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      participant: data
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Katılımcı güncellenemedi.") },
      { status: 500 }
    );
  }
}
