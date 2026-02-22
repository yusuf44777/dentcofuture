import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRaffleAdminSecret() {
  return process.env.RAFFLE_ADMIN_SECRET ?? "";
}

function isAuthorized(request: NextRequest) {
  return isModeratorRequestAuthorized(request, {
    secret: getRaffleAdminSecret(),
    secretHeaderName: "x-raffle-secret"
  });
}

function clampLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.max(1, Math.min(500, Math.floor(parsed)));
}

function getErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Katılımcı listesi alınamadı.";
  }

  return error instanceof Error ? error.message : "Katılımcı listesi alınamadı.";
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
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
