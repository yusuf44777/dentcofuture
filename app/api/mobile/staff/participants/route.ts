import { NextRequest, NextResponse } from "next/server";
import { isValidUuid, readJsonBody } from "@/lib/mobile/http";
import { logStaffOperation } from "@/lib/mobile/staff";
import { resolveStaffSession } from "@/lib/mobile/staff-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateBody = {
  fullName?: string;
  participantCode?: string;
  externalRef?: string;
  isActive?: boolean;
};

type PatchBody = {
  participantId?: string;
  fullName?: string;
  participantCode?: string;
  externalRef?: string;
  isActive?: boolean;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function clampLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.max(1, Math.min(500, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "staff.read");
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const limit = clampLimit(request.nextUrl.searchParams.get("limit"));
  const query = normalizeText(request.nextUrl.searchParams.get("q"));

  let participantsQuery = resolved.session.supabase
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
    return NextResponse.json({ error: `Katılımcılar alınamadı: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, participants: data ?? [] });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "participants.write", { requireStepUp: true });
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const body = await readJsonBody<CreateBody>(request);
  const fullName = normalizeText(body.fullName);
  const participantCode = normalizeText(body.participantCode);
  const externalRef = normalizeText(body.externalRef);
  const isActive = body.isActive !== false;

  if (fullName.length < 2 || fullName.length > 120) {
    return NextResponse.json({ error: "Ad soyad 2-120 karakter aralığında olmalı." }, { status: 400 });
  }

  try {
    const { data, error } = await resolved.session.supabase
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
      throw new Error(error.message);
    }

    await logStaffOperation(resolved.session, {
      operation: "staff.participants.create",
      targetType: "raffle_participant",
      targetId: data.id,
      success: true,
      details: {
        fullName,
        participantCode: participantCode || null,
        isActive
      }
    });

    return NextResponse.json({ ok: true, participant: data });
  } catch (error) {
    await logStaffOperation(resolved.session, {
      operation: "staff.participants.create",
      targetType: "raffle_participant",
      success: false,
      details: {
        fullName,
        participantCode: participantCode || null,
        error: error instanceof Error ? error.message : "Bilinmeyen hata"
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Katılımcı eklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "participants.write", { requireStepUp: true });
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const body = await readJsonBody<PatchBody>(request);
  const participantId = typeof body.participantId === "string" ? body.participantId.trim() : "";

  if (!isValidUuid(participantId)) {
    return NextResponse.json({ error: "Geçersiz katılımcı kimliği." }, { status: 400 });
  }

  const updates: {
    full_name?: string;
    participant_code?: string;
    external_ref?: string | null;
    is_active?: boolean;
  } = {};

  if (typeof body.fullName === "string") {
    const fullName = normalizeText(body.fullName);
    if (fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json({ error: "Ad soyad 2-120 karakter aralığında olmalı." }, { status: 400 });
    }

    updates.full_name = fullName;
  }

  if (typeof body.participantCode === "string") {
    const participantCode = normalizeText(body.participantCode);
    if (participantCode.length > 32) {
      return NextResponse.json({ error: "Katılımcı kodu en fazla 32 karakter olabilir." }, { status: 400 });
    }
    updates.participant_code = participantCode;
  }

  if (typeof body.externalRef === "string") {
    const externalRef = normalizeText(body.externalRef);
    if (externalRef.length > 80) {
      return NextResponse.json({ error: "Dış referans en fazla 80 karakter olabilir." }, { status: 400 });
    }

    updates.external_ref = externalRef.length > 0 ? externalRef : null;
  }

  if (typeof body.isActive === "boolean") {
    updates.is_active = body.isActive;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
  }

  try {
    const { data, error } = await resolved.session.supabase
      .from("raffle_participants")
      .update(updates)
      .eq("id", participantId)
      .select("id, full_name, participant_code, external_ref, is_active, created_at, updated_at")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({ error: "Katılımcı bulunamadı." }, { status: 404 });
    }

    await logStaffOperation(resolved.session, {
      operation: "staff.participants.update",
      targetType: "raffle_participant",
      targetId: participantId,
      success: true,
      details: updates
    });

    return NextResponse.json({ ok: true, participant: data });
  } catch (error) {
    await logStaffOperation(resolved.session, {
      operation: "staff.participants.update",
      targetType: "raffle_participant",
      targetId: participantId,
      success: false,
      details: {
        updates,
        error: error instanceof Error ? error.message : "Bilinmeyen hata"
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Katılımcı güncellenemedi." },
      { status: 500 }
    );
  }
}
