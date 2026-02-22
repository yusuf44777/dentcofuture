import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { importParticipantsFromRows } from "@/lib/raffle/import-participants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportPayload = {
  rows?: string;
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
    return "Katılımcı içe aktarma sırasında bir hata oluştu.";
  }

  return error instanceof Error ? error.message : "Katılımcı içe aktarma sırasında bir hata oluştu.";
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
    const result = await importParticipantsFromRows(rawRows);
    return NextResponse.json(result);
  } catch (error) {
    const invalidLines = (error as Error & { invalid_lines?: unknown }).invalid_lines;
    return NextResponse.json(
      {
        error: getErrorMessage(error),
        invalid_lines: Array.isArray(invalidLines) ? invalidLines : undefined
      },
      { status: 400 }
    );
  }
}
