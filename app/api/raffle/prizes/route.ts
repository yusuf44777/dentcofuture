import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatePrizePayload = {
  title?: string;
  description?: string;
  quantity?: number;
  allowPreviousWinner?: boolean;
};

type UpdatePrizePayload = {
  prizeId?: string;
  title?: string;
  description?: string;
  quantity?: number;
  isActive?: boolean;
  allowPreviousWinner?: boolean;
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

function getErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Ödül işlemi sırasında hata oluştu.";
  }

  return error instanceof Error ? error.message : "Ödül işlemi sırasında hata oluştu.";
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("raffle_prizes")
      .select("id, title, description, quantity, allow_previous_winner, is_active, created_at, updated_at")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Ödüller alınamadı: ${error.message}`);
    }

    return NextResponse.json({ prizes: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let payload: CreatePrizePayload = {};
  try {
    payload = (await request.json()) as CreatePrizePayload;
  } catch {
    payload = {};
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const descriptionRaw = typeof payload.description === "string" ? payload.description.trim() : "";
  const description = descriptionRaw.length > 0 ? descriptionRaw : null;
  const quantity = Number.isFinite(Number(payload.quantity)) ? Number(payload.quantity) : 1;
  const allowPreviousWinner = payload.allowPreviousWinner === true;

  if (title.length < 2 || title.length > 140) {
    return NextResponse.json({ error: "Ödül başlığı 2-140 karakter aralığında olmalı." }, { status: 400 });
  }

  if (description && description.length > 300) {
    return NextResponse.json({ error: "Ödül açıklaması en fazla 300 karakter olabilir." }, { status: 400 });
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return NextResponse.json({ error: "Ödül adedi 1-100 arasında bir tam sayı olmalı." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("raffle_prizes")
      .insert({
        title,
        description,
        quantity,
        allow_previous_winner: allowPreviousWinner,
        is_active: true
      })
      .select("id, title, description, quantity, allow_previous_winner, is_active, created_at, updated_at")
      .single();

    if (error) {
      throw new Error(`Ödül oluşturulamadı: ${error.message}`);
    }

    return NextResponse.json({ ok: true, prize: data });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let payload: UpdatePrizePayload = {};
  try {
    payload = (await request.json()) as UpdatePrizePayload;
  } catch {
    payload = {};
  }

  const prizeId = typeof payload.prizeId === "string" ? payload.prizeId.trim() : "";
  if (!isValidUuid(prizeId)) {
    return NextResponse.json({ error: "Geçersiz ödül kimliği." }, { status: 400 });
  }

  const updates: {
    title?: string;
    description?: string | null;
    quantity?: number;
    is_active?: boolean;
    allow_previous_winner?: boolean;
  } = {};

  if (typeof payload.title === "string") {
    const title = payload.title.trim();
    if (title.length < 2 || title.length > 140) {
      return NextResponse.json({ error: "Ödül başlığı 2-140 karakter aralığında olmalı." }, { status: 400 });
    }
    updates.title = title;
  }

  if (typeof payload.description === "string") {
    const description = payload.description.trim();
    if (description.length > 300) {
      return NextResponse.json({ error: "Ödül açıklaması en fazla 300 karakter olabilir." }, { status: 400 });
    }
    updates.description = description.length > 0 ? description : null;
  }

  if (typeof payload.quantity !== "undefined") {
    const quantity = Number(payload.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return NextResponse.json({ error: "Ödül adedi 1-100 arasında bir tam sayı olmalı." }, { status: 400 });
    }
    updates.quantity = quantity;
  }

  if (typeof payload.isActive === "boolean") {
    updates.is_active = payload.isActive;
  }

  if (typeof payload.allowPreviousWinner === "boolean") {
    updates.allow_previous_winner = payload.allowPreviousWinner;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan bulunamadı." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("raffle_prizes")
      .update(updates)
      .eq("id", prizeId)
      .select("id, title, description, quantity, allow_previous_winner, is_active, created_at, updated_at")
      .single();

    if (error) {
      throw new Error(`Ödül güncellenemedi: ${error.message}`);
    }

    return NextResponse.json({ ok: true, prize: data });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
