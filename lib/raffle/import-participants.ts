import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_IMPORT_LINES = 5000;

type ParsedParticipant = {
  fullName: string;
  participantCode?: string;
  externalRef?: string;
};

type InvalidLine = {
  line: number;
  value: string;
  reason: string;
};

function sanitizeName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").trim();
}

function parseLine(line: string): ParsedParticipant | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const parseWithSeparator = (separator: "|" | ";") => {
    if (!trimmed.includes(separator)) {
      return null;
    }

    const parts = trimmed
      .split(separator)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return null;
    }

    const fullName = sanitizeName(parts[0] ?? "");
    if (!fullName) {
      return null;
    }

    const participantCode = normalizeCode(parts[1] ?? "");
    const externalRef = sanitizeName(parts[2] ?? "");

    return {
      fullName,
      participantCode: participantCode || undefined,
      externalRef: externalRef || undefined
    };
  };

  const byPipe = parseWithSeparator("|");
  if (byPipe) {
    return byPipe;
  }

  const bySemicolon = parseWithSeparator(";");
  if (bySemicolon) {
    return bySemicolon;
  }

  const commaParts = trimmed.split(",");
  if (commaParts.length >= 2) {
    const maybeCode = normalizeCode(commaParts[commaParts.length - 1] ?? "");
    const maybeName = sanitizeName(commaParts.slice(0, -1).join(","));

    if (maybeName && maybeCode.length >= 4) {
      return {
        fullName: maybeName,
        participantCode: maybeCode
      };
    }
  }

  return {
    fullName: sanitizeName(trimmed)
  };
}

function validateParsedParticipant(participant: ParsedParticipant) {
  if (!participant.fullName || participant.fullName.length < 2 || participant.fullName.length > 120) {
    return "Ad Soyad 2-120 karakter aralığında olmalı.";
  }

  if (participant.participantCode) {
    if (participant.participantCode.length < 4 || participant.participantCode.length > 32) {
      return "Özel kod 4-32 karakter olmalı.";
    }
  }

  if (participant.externalRef && participant.externalRef.length > 80) {
    return "Harici referans en fazla 80 karakter olabilir.";
  }

  return "";
}

export async function importParticipantsFromRows(rawRows: string) {
  const lines = rawRows
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("Aktarılacak satır bulunamadı.");
  }

  if (lines.length > MAX_IMPORT_LINES) {
    throw new Error(`Tek seferde en fazla ${MAX_IMPORT_LINES} satır aktarabilirsiniz.`);
  }

  const invalidLines: InvalidLine[] = [];
  const parsedRows: ParsedParticipant[] = [];

  lines.forEach((line, index) => {
    const parsed = parseLine(line);
    if (!parsed) {
      invalidLines.push({
        line: index + 1,
        value: line,
        reason: "Satır ayrıştırılamadı."
      });
      return;
    }

    const validationError = validateParsedParticipant(parsed);
    if (validationError) {
      invalidLines.push({
        line: index + 1,
        value: line,
        reason: validationError
      });
      return;
    }

    parsedRows.push(parsed);
  });

  if (parsedRows.length === 0) {
    const error = new Error("Geçerli katılımcı satırı bulunamadı.");
    (error as Error & { invalid_lines?: InvalidLine[] }).invalid_lines = invalidLines.slice(0, 20);
    throw error;
  }

  const supabase = createSupabaseAdminClient();

  const dedupWithCode = new Map<string, ParsedParticipant>();
  const dedupWithoutCode = new Map<string, ParsedParticipant>();

  for (const row of parsedRows) {
    if (row.participantCode) {
      dedupWithCode.set(row.participantCode, row);
    } else {
      const key = `${row.fullName.toLocaleLowerCase("tr-TR")}|${row.externalRef ?? ""}`;
      if (!dedupWithoutCode.has(key)) {
        dedupWithoutCode.set(key, row);
      }
    }
  }

  const rowsWithCode = Array.from(dedupWithCode.values());
  const rowsWithoutCode = Array.from(dedupWithoutCode.values());

  let updatedCount = 0;
  const sampleRows: Array<{ full_name: string; participant_code: string }> = [];

  if (rowsWithCode.length > 0) {
    const codes = rowsWithCode.map((row) => row.participantCode as string);

    const { data: existingRows, error: existingRowsError } = await supabase
      .from("raffle_participants")
      .select("participant_code")
      .in("participant_code", codes);

    if (existingRowsError) {
      throw new Error(`Mevcut kodlar kontrol edilemedi: ${existingRowsError.message}`);
    }

    const existingCodeSet = new Set(
      (existingRows ?? [])
        .map((row) => row.participant_code)
        .filter((code): code is string => typeof code === "string")
    );
    updatedCount = codes.filter((code) => existingCodeSet.has(code)).length;

    const { data: upsertedRows, error: upsertError } = await supabase
      .from("raffle_participants")
      .upsert(
        rowsWithCode.map((row) => ({
          full_name: row.fullName,
          participant_code: row.participantCode,
          external_ref: row.externalRef ?? null,
          is_active: true
        })),
        {
          onConflict: "participant_code",
          ignoreDuplicates: false
        }
      )
      .select("full_name, participant_code");

    if (upsertError) {
      throw new Error(`Kodlu katılımcılar kaydedilemedi: ${upsertError.message}`);
    }

    for (const row of upsertedRows ?? []) {
      sampleRows.push({
        full_name: row.full_name,
        participant_code: row.participant_code
      });
    }
  }

  if (rowsWithoutCode.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from("raffle_participants")
      .insert(
        rowsWithoutCode.map((row) => ({
          full_name: row.fullName,
          external_ref: row.externalRef ?? null,
          is_active: true
        }))
      )
      .select("full_name, participant_code");

    if (insertError) {
      throw new Error(`Kodsuz katılımcılar kaydedilemedi: ${insertError.message}`);
    }

    for (const row of insertedRows ?? []) {
      sampleRows.push({
        full_name: row.full_name,
        participant_code: row.participant_code
      });
    }
  }

  const insertedCount = sampleRows.length - updatedCount;

  return {
    ok: true,
    parsed_lines: parsedRows.length,
    imported_total: sampleRows.length,
    inserted_count: insertedCount,
    updated_count: updatedCount,
    invalid_lines: invalidLines.slice(0, 20),
    sample_codes: sampleRows.slice(0, 20)
  };
}
