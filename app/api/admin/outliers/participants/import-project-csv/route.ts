import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { importMobileAllowedParticipantsFromCsv } from "@/lib/outliers/import-mobile-allowed-participants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CSV_FILE_NAME = "outliers_katilimci.csv";

function getImportSecret() {
  return process.env.OUTLIERS_ADMIN_SECRET ?? process.env.RAFFLE_ADMIN_SECRET ?? "";
}

function isAuthorized(request: NextRequest) {
  return isModeratorRequestAuthorized(request, {
    secret: getImportSecret(),
    secretHeaderName: "x-outliers-secret"
  });
}

function getCsvPath() {
  const customPath = process.env.OUTLIERS_PARTICIPANT_CSV_PATH?.trim();
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.join(process.cwd(), customPath);
  }

  return path.join(process.cwd(), DEFAULT_CSV_FILE_NAME);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Proje CSV içe aktarımı sırasında hata oluştu.";
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  try {
    const csvPath = getCsvPath();
    const content = await readFile(csvPath, "utf8");
    const result = await importMobileAllowedParticipantsFromCsv(content);

    return NextResponse.json({
      ...result,
      source: path.relative(process.cwd(), csvPath) || DEFAULT_CSV_FILE_NAME
    });
  } catch (error) {
    const invalidLines = (error as Error & { invalid_lines?: unknown }).invalid_lines;
    const message = getErrorMessage(error);

    return NextResponse.json(
      {
        error: "Proje CSV içe aktarımı sırasında hata oluştu.",
        detail: message,
        invalid_lines: Array.isArray(invalidLines) ? invalidLines : undefined
      },
      { status: 400 }
    );
  }
}
