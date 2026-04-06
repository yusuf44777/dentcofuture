import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchPayload = {
  questionId?: string;
  pinned?: boolean;
  answered?: boolean;
};

function getDashboardAdminSecret() {
  return process.env.RAFFLE_ADMIN_SECRET ?? "";
}

function isAuthorized(request: NextRequest) {
  return isModeratorRequestAuthorized(request, {
    secret: getDashboardAdminSecret(),
    secretHeaderName: "x-raffle-secret"
  });
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (process.env.NODE_ENV === "production") {
    return fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("questions")
      .select("id, text, votes, answered, pinned, created_at, attendee:attendees(name, role)")
      .order("pinned", { ascending: false })
      .order("votes", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(150);

    if (error) {
      throw new Error(`Sorular alınamadı: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      questions: data ?? []
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Sorular alınamadı.") },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let payload: PatchPayload = {};
  try {
    payload = (await request.json()) as PatchPayload;
  } catch {
    payload = {};
  }

  const questionId = typeof payload.questionId === "string" ? payload.questionId.trim() : "";
  if (!isValidUuid(questionId)) {
    return NextResponse.json({ error: "Geçersiz soru kimliği." }, { status: 400 });
  }

  const updates: { pinned?: boolean; answered?: boolean } = {};
  if (typeof payload.pinned === "boolean") {
    updates.pinned = payload.pinned;
  }
  if (typeof payload.answered === "boolean") {
    updates.answered = payload.answered;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan bulunamadı." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("questions")
      .update(updates)
      .eq("id", questionId)
      .select("id, text, votes, answered, pinned, created_at, attendee:attendees(name, role)")
      .maybeSingle();

    if (error) {
      throw new Error(`Soru güncellenemedi: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      question: data
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Soru güncellenemedi.") },
      { status: 500 }
    );
  }
}
