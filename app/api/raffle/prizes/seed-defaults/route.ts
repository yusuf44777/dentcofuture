import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { DEFAULT_RAFFLE_PRIZES } from "@/lib/raffle/default-prizes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PrizeRow = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  allow_previous_winner: boolean;
  is_active: boolean;
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

function normalizePrizeTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
}

function getErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Hazır ödül seti yüklenemedi.";
  }

  return error instanceof Error ? error.message : "Hazır ödül seti yüklenemedi.";
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: existingPrizes, error: existingPrizesError } = await supabase
      .from("raffle_prizes")
      .select("id, title, description, quantity, allow_previous_winner, is_active");

    if (existingPrizesError) {
      throw new Error(`Mevcut ödüller alınamadı: ${existingPrizesError.message}`);
    }

    const existingByTitle = new Map<string, PrizeRow>();
    for (const prize of (existingPrizes ?? []) as PrizeRow[]) {
      const key = normalizePrizeTitle(prize.title);
      if (!existingByTitle.has(key)) {
        existingByTitle.set(key, prize);
      }
    }

    let insertedCount = 0;
    let updatedCount = 0;
    const touchedPrizes: Array<{ id: string; title: string; quantity: number; status: "inserted" | "updated" }> = [];

    for (const prize of DEFAULT_RAFFLE_PRIZES) {
      const existing = existingByTitle.get(normalizePrizeTitle(prize.title));

      if (!existing) {
        const { data, error } = await supabase
          .from("raffle_prizes")
          .insert({
            title: prize.title,
            description: prize.description,
            quantity: prize.quantity,
            allow_previous_winner: false,
            is_active: true
          })
          .select("id, title, quantity")
          .single();

        if (error) {
          throw new Error(`${prize.title} eklenemedi: ${error.message}`);
        }

        insertedCount += 1;
        touchedPrizes.push({
          id: data.id,
          title: data.title,
          quantity: data.quantity,
          status: "inserted"
        });
        continue;
      }

      const needsUpdate =
        existing.quantity !== prize.quantity ||
        existing.description !== prize.description ||
        existing.allow_previous_winner ||
        !existing.is_active;

      if (!needsUpdate) {
        continue;
      }

      const { data, error } = await supabase
        .from("raffle_prizes")
        .update({
          description: prize.description,
          quantity: prize.quantity,
          allow_previous_winner: false,
          is_active: true
        })
        .eq("id", existing.id)
        .select("id, title, quantity")
        .single();

      if (error) {
        throw new Error(`${prize.title} güncellenemedi: ${error.message}`);
      }

      updatedCount += 1;
      touchedPrizes.push({
        id: data.id,
        title: data.title,
        quantity: data.quantity,
        status: "updated"
      });
    }

    return NextResponse.json({
      ok: true,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      skipped_count: DEFAULT_RAFFLE_PRIZES.length - insertedCount - updatedCount,
      prizes: touchedPrizes
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
