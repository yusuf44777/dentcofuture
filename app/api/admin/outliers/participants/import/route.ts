import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { importMobileAllowedParticipantsFromCsv } from "@/lib/outliers/import-mobile-allowed-participants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportPayload = {
  rows?: string;
};

function getImportSecret() {
  return process.env.OUTLIERS_ADMIN_SECRET ?? process.env.RAFFLE_ADMIN_SECRET ?? "";
}

function isAuthorized(request: NextRequest) {
  return isModeratorRequestAuthorized(request, {
    secret: getImportSecret(),
    secretHeaderName: "x-outliers-secret"
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "CSV içe aktarımı sırasında bir hata oluştu.";
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  let payload: ImportPayload = {};
  try {
    payload = (await request.json()) as ImportPayload;
  } catch {
    payload = {};
  }

  const rawRows = typeof payload.rows === "string" ? payload.rows : "";

  try {
    const result = await importMobileAllowedParticipantsFromCsv(rawRows);
    return NextResponse.json(result);
  } catch (error) {
    const invalidLines = (error as Error & { invalid_lines?: unknown }).invalid_lines;
    return NextResponse.json(
      {
        error: "CSV içe aktarımı sırasında bir hata oluştu.",
        detail: getErrorMessage(error),
        invalid_lines: Array.isArray(invalidLines) ? invalidLines : undefined
      },
      { status: 400 }
    );
  }
}
