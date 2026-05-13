import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_IMPORT_LINES = 5000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type ParsedParticipant = {
  fullName: string;
  participantCode?: string;
  externalRef?: string;
};

type ParsedLine = {
  line: number;
  raw: string;
  cells: string[];
};

type InvalidLine = {
  line: number;
  value: string;
  reason: string;
};

type HeaderMapping = {
  fullName: number;
  participantCode: number;
  externalRef: number;
  email: number;
  phone: number;
};

const HEADER_ALIASES: Record<keyof HeaderMapping, string[]> = {
  fullName: [
    "ad soyad",
    "adsoyad",
    "isim soyisim",
    "katilimci",
    "katilimci adi",
    "katilimci ad soyad",
    "full name",
    "fullname",
    "name"
  ],
  participantCode: [
    "kod",
    "cekilis kodu",
    "katilimci kodu",
    "participant code",
    "raffle code",
    "code"
  ],
  externalRef: ["referans", "ref", "external ref", "external_ref", "id", "kayit no", "registration id"],
  email: ["email", "e posta", "eposta", "mail"],
  phone: ["telefon", "telefon no", "telefon numarasi", "gsm", "cep telefonu", "phone", "mobile"]
};

function sanitizeName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").trim();
}

function normalizeHeader(value: string) {
  return sanitizeName(
    value
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[_-]+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
  );
}

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^\uFEFF/, "").trim());
}

function detectDelimiter(lines: string[]) {
  const candidates = [",", ";", "\t", "|"];
  const sample = lines.slice(0, 5).join("\n");
  let best: { delimiter: string; score: number } = { delimiter: ",", score: -1 };

  for (const delimiter of candidates) {
    const score = sample.split(delimiter).length - 1;
    if (score > best.score) {
      best = { delimiter, score };
    }
  }

  return best.score > 0 ? best.delimiter : ",";
}

function isKnownHeader(value: string) {
  const normalized = normalizeHeader(value);
  return Object.values(HEADER_ALIASES).some((aliases) => aliases.includes(normalized));
}

function findLikelyHeaderRowIndex(rows: ParsedLine[]) {
  for (let i = 0; i < Math.min(rows.length, 3); i += 1) {
    const headers = rows[i]?.cells.map((cell) => normalizeHeader(cell)) ?? [];
    const headerHits = headers.filter((header) =>
      Object.values(HEADER_ALIASES).some((aliases) => aliases.includes(header))
    ).length;
    const hasNameHeader = headers.some((header) => HEADER_ALIASES.fullName.includes(header));

    if (headerHits >= 2 || (hasNameHeader && rows[i]!.cells.length <= 2)) {
      return i;
    }
  }

  return -1;
}

function getHeaderMapping(headers: string[]): HeaderMapping {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));

  const findAliasIndex = (aliases: string[]) => {
    for (let i = 0; i < normalizedHeaders.length; i += 1) {
      if (aliases.includes(normalizedHeaders[i] ?? "")) {
        return i;
      }
    }
    return -1;
  };

  return {
    fullName: findAliasIndex(HEADER_ALIASES.fullName),
    participantCode: findAliasIndex(HEADER_ALIASES.participantCode),
    externalRef: findAliasIndex(HEADER_ALIASES.externalRef),
    email: findAliasIndex(HEADER_ALIASES.email),
    phone: findAliasIndex(HEADER_ALIASES.phone)
  };
}

function getCell(cells: string[], index: number) {
  if (index < 0 || index >= cells.length) {
    return "";
  }

  return sanitizeName(cells[index] ?? "");
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D+/g, "");
  if (digits.startsWith("90") && digits.length === 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }
  return digits;
}

function findEmailIndex(cells: string[]) {
  return cells.findIndex((cell) => EMAIL_REGEX.test(cell.trim().toLocaleLowerCase("tr-TR")));
}

function findPhoneIndex(cells: string[]) {
  return cells.findIndex((cell) => {
    const phone = normalizePhone(cell);
    return phone.length === 10 && phone.startsWith("5");
  });
}

function buildExternalRef(externalRef: string, email: string, phone: string) {
  const parts = [
    externalRef ? `ref:${externalRef}` : "",
    email ? `email:${email}` : "",
    phone ? `tel:${phone}` : ""
  ].filter(Boolean);

  const combined = parts.join(" | ");
  return combined.length > 0 ? combined.slice(0, 80) : undefined;
}

function findLikelyName(cells: string[], excludedIndexes: Set<number>) {
  return (
    cells
      .map((cell, index) => ({ cell: sanitizeName(cell), index }))
      .find(({ cell, index }) => {
        if (!cell || excludedIndexes.has(index) || isKnownHeader(cell) || EMAIL_REGEX.test(cell)) {
          return false;
        }

        const phone = normalizePhone(cell);
        return !(phone.length === 10 && phone.startsWith("5"));
      })?.cell ?? ""
  );
}

function parseLineWithHeaders(row: ParsedLine, headerMapping: HeaderMapping): ParsedParticipant | null {
  const email = getCell(row.cells, headerMapping.email).toLocaleLowerCase("tr-TR");
  const phone = normalizePhone(getCell(row.cells, headerMapping.phone));
  const excludedIndexes = new Set(
    [headerMapping.email, headerMapping.phone, headerMapping.participantCode, headerMapping.externalRef].filter(
      (index) => index >= 0
    )
  );
  const fullName =
    sanitizeName(getCell(row.cells, headerMapping.fullName)) || findLikelyName(row.cells, excludedIndexes);

  if (!fullName) {
    return null;
  }

  const participantCode = normalizeCode(getCell(row.cells, headerMapping.participantCode));
  const externalRef = buildExternalRef(getCell(row.cells, headerMapping.externalRef), email, phone);

  return {
    fullName,
    participantCode: participantCode || undefined,
    externalRef
  };
}

function parseLineWithHeuristics(row: ParsedLine): ParsedParticipant | null {
  const emailIndex = findEmailIndex(row.cells);
  const phoneIndex = findPhoneIndex(row.cells);
  const excludedIndexes = new Set([emailIndex, phoneIndex].filter((index) => index >= 0));
  const fullName = findLikelyName(row.cells, excludedIndexes);

  if (!fullName) {
    return parseLine(row.raw);
  }

  const email = emailIndex >= 0 ? row.cells[emailIndex]!.trim().toLocaleLowerCase("tr-TR") : "";
  const phone = phoneIndex >= 0 ? normalizePhone(row.cells[phoneIndex] ?? "") : "";
  const canTreatExtraCellAsCode = emailIndex < 0 && phoneIndex < 0;
  const codeCell = canTreatExtraCellAsCode
    ? row.cells.find((cell) => {
        const normalized = normalizeCode(cell);
        return normalized.length >= 4 && normalized.length <= 32 && normalized !== normalizeCode(fullName);
      })
    : "";
  const participantCode = normalizeCode(codeCell ?? "");

  return {
    fullName,
    participantCode: participantCode || undefined,
    externalRef: buildExternalRef("", email, phone)
  };
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
    .replace(/^\uFEFF/, "")
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
  const delimiter = detectDelimiter(lines);
  const parsedLines: ParsedLine[] = lines.map((line, index) => ({
    line: index + 1,
    raw: line,
    cells: parseCsvLine(line, delimiter)
  }));
  const headerRowIndex = findLikelyHeaderRowIndex(parsedLines);
  const headerMapping = headerRowIndex >= 0 ? getHeaderMapping(parsedLines[headerRowIndex]!.cells) : null;

  parsedLines.forEach((line) => {
    if (line.line === headerRowIndex + 1) {
      return;
    }

    const parsed = headerMapping ? parseLineWithHeaders(line, headerMapping) : parseLineWithHeuristics(line);
    if (!parsed) {
      invalidLines.push({
        line: line.line,
        value: line.raw,
        reason: "Satır ayrıştırılamadı."
      });
      return;
    }

    const validationError = validateParsedParticipant(parsed);
    if (validationError) {
      invalidLines.push({
        line: line.line,
        value: line.raw,
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
      const key = row.externalRef
        ? `ref:${row.externalRef}`
        : `${row.fullName.toLocaleLowerCase("tr-TR")}|`;
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
    const rowsWithoutCodeWithRef = rowsWithoutCode.filter(
      (row): row is ParsedParticipant & { externalRef: string } => Boolean(row.externalRef)
    );
    const rowsWithoutCodeWithoutRef = rowsWithoutCode.filter((row) => !row.externalRef);
    let rowsWithoutCodeToInsert: ParsedParticipant[] = [...rowsWithoutCodeWithoutRef];

    if (rowsWithoutCodeWithRef.length > 0) {
      const refs = rowsWithoutCodeWithRef.map((row) => row.externalRef);
      const existingRowsByRef = new Map<
        string,
        { id: string; full_name: string; participant_code: string; external_ref: string }
      >();
      const chunkSize = 500;

      for (let start = 0; start < refs.length; start += chunkSize) {
        const refChunk = refs.slice(start, start + chunkSize);
        const { data: existingRows, error: existingRowsError } = await supabase
          .from("raffle_participants")
          .select("id, full_name, participant_code, external_ref")
          .in("external_ref", refChunk);

        if (existingRowsError) {
          throw new Error(`Referanslı katılımcılar kontrol edilemedi: ${existingRowsError.message}`);
        }

        for (const row of existingRows ?? []) {
          if (typeof row.external_ref === "string") {
            existingRowsByRef.set(row.external_ref, {
              id: row.id,
              full_name: row.full_name,
              participant_code: row.participant_code,
              external_ref: row.external_ref
            });
          }
        }
      }

      const updatePayload: Array<{
        id: string;
        full_name: string;
        participant_code: string;
        external_ref: string;
        is_active: boolean;
      }> = [];
      const rowsWithoutRefMatch: ParsedParticipant[] = [];

      for (const row of rowsWithoutCodeWithRef) {
        const existing = existingRowsByRef.get(row.externalRef);
        if (!existing) {
          rowsWithoutRefMatch.push(row);
          continue;
        }

        updatePayload.push({
          id: existing.id,
          full_name: row.fullName,
          participant_code: existing.participant_code,
          external_ref: row.externalRef,
          is_active: true
        });
      }

      rowsWithoutCodeToInsert = [...rowsWithoutCodeToInsert, ...rowsWithoutRefMatch];

      if (updatePayload.length > 0) {
        const { data: updatedRows, error: updateError } = await supabase
          .from("raffle_participants")
          .upsert(updatePayload, { onConflict: "id", ignoreDuplicates: false })
          .select("full_name, participant_code");

        if (updateError) {
          throw new Error(`Referanslı katılımcılar güncellenemedi: ${updateError.message}`);
        }

        updatedCount += updatedRows?.length ?? updatePayload.length;

        for (const row of updatedRows ?? []) {
          sampleRows.push({
            full_name: row.full_name,
            participant_code: row.participant_code
          });
        }
      }
    }

    if (rowsWithoutCodeToInsert.length === 0) {
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

    const { data: insertedRows, error: insertError } = await supabase
      .from("raffle_participants")
      .insert(
        rowsWithoutCodeToInsert.map((row) => ({
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
