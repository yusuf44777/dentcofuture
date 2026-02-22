import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { importParticipantsFromRows } from "@/lib/raffle/import-participants";

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

function getErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Proje CSV içe aktarma sırasında hata oluştu.";
  }

  return error instanceof Error ? error.message : "Proje CSV içe aktarma sırasında hata oluştu.";
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  try {
    const csvPath = path.join(process.cwd(), "cekilis.csv");
    const content = await readFile(csvPath, "utf8");
    const result = await importParticipantsFromRows(content);

    return NextResponse.json({
      ...result,
      source: "cekilis.csv"
    });
  } catch (error) {
    const invalidLines = (error as Error & { invalid_lines?: unknown }).invalid_lines;
    const message = getErrorMessage(error);
    return NextResponse.json(
      {
        error: message,
        invalid_lines: Array.isArray(invalidLines) ? invalidLines : undefined
      },
      { status: 400 }
    );
  }
}
