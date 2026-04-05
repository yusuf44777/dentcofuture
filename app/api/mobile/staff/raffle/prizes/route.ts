import { NextRequest, NextResponse } from "next/server";
import { isValidUuid, readJsonBody } from "@/lib/mobile/http";
import { logStaffOperation } from "@/lib/mobile/staff";
import { resolveStaffSession } from "@/lib/mobile/staff-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateBody = {
  title?: string;
  description?: string;
  quantity?: number;
  allowPreviousWinner?: boolean;
  isActive?: boolean;
};

type PatchBody = {
  prizeId?: string;
  title?: string;
  description?: string;
  quantity?: number;
  allowPreviousWinner?: boolean;
  isActive?: boolean;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

export async function GET(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "staff.read");
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const { data, error } = await resolved.session.supabase
    .from("raffle_prizes")
    .select("id, title, description, quantity, allow_previous_winner, is_active, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: `Ödüller alınamadı: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, prizes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "raffle.write", { requireStepUp: true });
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const body = await readJsonBody<CreateBody>(request);
  const title = normalizeText(body.title);
  const descriptionRaw = normalizeText(body.description);
  const description = descriptionRaw.length > 0 ? descriptionRaw : null;
  const quantity = Number(body.quantity ?? 1);
  const allowPreviousWinner = body.allowPreviousWinner === true;
  const isActive = body.isActive !== false;

  if (title.length < 2 || title.length > 140) {
    return NextResponse.json({ error: "Ödül başlığı 2-140 karakter aralığında olmalı." }, { status: 400 });
  }

  if (description && description.length > 300) {
    return NextResponse.json({ error: "Ödül açıklaması en fazla 300 karakter olabilir." }, { status: 400 });
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return NextResponse.json({ error: "Ödül adedi 1-100 arası tam sayı olmalı." }, { status: 400 });
  }

  try {
    const { data, error } = await resolved.session.supabase
      .from("raffle_prizes")
      .insert({
        title,
        description,
        quantity,
        allow_previous_winner: allowPreviousWinner,
        is_active: isActive
      })
      .select("id, title, description, quantity, allow_previous_winner, is_active, created_at, updated_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await logStaffOperation(resolved.session, {
      operation: "staff.raffle.prizes.create",
      targetType: "raffle_prize",
      targetId: data.id,
      success: true,
      details: {
        title,
        quantity,
        allowPreviousWinner,
        isActive
      }
    });

    return NextResponse.json({ ok: true, prize: data });
  } catch (error) {
    await logStaffOperation(resolved.session, {
      operation: "staff.raffle.prizes.create",
      targetType: "raffle_prize",
      success: false,
      details: {
        title,
        quantity,
        error: error instanceof Error ? error.message : "Bilinmeyen hata"
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ödül oluşturulamadı." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const resolved = await resolveStaffSession(request, "raffle.write", { requireStepUp: true });
  if ("errorResponse" in resolved) {
    return resolved.errorResponse;
  }

  const body = await readJsonBody<PatchBody>(request);
  const prizeId = typeof body.prizeId === "string" ? body.prizeId.trim() : "";

  if (!isValidUuid(prizeId)) {
    return NextResponse.json({ error: "Geçersiz ödül kimliği." }, { status: 400 });
  }

  const updates: {
    title?: string;
    description?: string | null;
    quantity?: number;
    allow_previous_winner?: boolean;
    is_active?: boolean;
  } = {};

  if (typeof body.title === "string") {
    const title = normalizeText(body.title);
    if (title.length < 2 || title.length > 140) {
      return NextResponse.json({ error: "Ödül başlığı 2-140 karakter aralığında olmalı." }, { status: 400 });
    }
    updates.title = title;
  }

  if (typeof body.description === "string") {
    const description = normalizeText(body.description);
    if (description.length > 300) {
      return NextResponse.json({ error: "Ödül açıklaması en fazla 300 karakter olabilir." }, { status: 400 });
    }

    updates.description = description.length > 0 ? description : null;
  }

  if (typeof body.quantity !== "undefined") {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return NextResponse.json({ error: "Ödül adedi 1-100 arası tam sayı olmalı." }, { status: 400 });
    }

    updates.quantity = quantity;
  }

  if (typeof body.allowPreviousWinner === "boolean") {
    updates.allow_previous_winner = body.allowPreviousWinner;
  }

  if (typeof body.isActive === "boolean") {
    updates.is_active = body.isActive;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
  }

  try {
    const { data, error } = await resolved.session.supabase
      .from("raffle_prizes")
      .update(updates)
      .eq("id", prizeId)
      .select("id, title, description, quantity, allow_previous_winner, is_active, created_at, updated_at")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({ error: "Ödül bulunamadı." }, { status: 404 });
    }

    await logStaffOperation(resolved.session, {
      operation: "staff.raffle.prizes.update",
      targetType: "raffle_prize",
      targetId: prizeId,
      success: true,
      details: updates
    });

    return NextResponse.json({ ok: true, prize: data });
  } catch (error) {
    await logStaffOperation(resolved.session, {
      operation: "staff.raffle.prizes.update",
      targetType: "raffle_prize",
      targetId: prizeId,
      success: false,
      details: {
        updates,
        error: error instanceof Error ? error.message : "Bilinmeyen hata"
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ödül güncellenemedi." },
      { status: 500 }
    );
  }
}
