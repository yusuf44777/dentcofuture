import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { isModeratorRequestAuthorized } from "@/lib/auth/moderator-request";
import { importParticipantsFromRows } from "@/lib/raffle/import-participants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CSV_FILE_NAMES = ["outliers_cekilis.csv", "cekilis.csv"];

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

async function readProjectCsv() {
  const configuredPath = process.env.RAFFLE_PARTICIPANT_CSV_PATH?.trim();
  const candidates = configuredPath
    ? [path.isAbsolute(configuredPath) ? configuredPath : path.join(process.cwd(), configuredPath)]
    : DEFAULT_CSV_FILE_NAMES.map((fileName) => path.join(process.cwd(), fileName));

  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return {
        content: await readFile(candidate, "utf8"),
        source: path.relative(process.cwd(), candidate) || path.basename(candidate)
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${candidate} okunamadı.`);
    }
  }

  throw new Error(
    `CSV dosyası bulunamadı. Beklenen dosya adları: ${DEFAULT_CSV_FILE_NAMES.join(", ")}. ${errors.join(" ")}`
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  try {
    const { content, source } = await readProjectCsv();
    const result = await importParticipantsFromRows(content);

    return NextResponse.json({
      ...result,
      source
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
