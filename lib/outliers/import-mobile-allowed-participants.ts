import { normalizeEmail, normalizePhone } from "@/lib/mobile/participant-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_IMPORT_LINES = 10000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const HEADER_ROLE_VALUES = new Set(["student", "academic", "clinician", "entrepreneur", "industry"]);

type ParsedLine = {
  line: number;
  raw: string;
  cells: string[];
};

type ParsedParticipant = {
  line: number;
  raw: string;
  fullName: string | null;
  email: string;
  phone: string;
  role: string | null;
  classLevel: string | null;
  instagram: string | null;
  linkedin: string | null;
  outlierScore: number | null;
  isActive: boolean;
};

type MobileAllowedParticipantRow = {
  id: string;
  email: string;
  phone: string;
  is_active: boolean;
  notes: string | null;
};

type InvalidLine = {
  line: number;
  value: string;
  reason: string;
};

type HeaderMapping = {
  fullName: number;
  email: number;
  phone: number;
  role: number;
  classLevel: number;
  instagram: number;
  linkedin: number;
  outlierScore: number;
  isActive: number;
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
  email: ["email", "e posta", "eposta", "mail"],
  phone: ["telefon", "telefon no", "telefon numarasi", "gsm", "cep telefonu", "phone", "mobile"],
  role: ["rol", "role", "meslek", "unvan"],
  classLevel: ["sinif", "sinif seviyesi", "class", "class level", "class_level"],
  instagram: ["instagram", "insta", "ig"],
  linkedin: ["linkedin", "linked in"],
  outlierScore: ["outlier", "outlier puani", "outlier score", "score", "puan"],
  isActive: ["aktif", "active", "is active", "is_active", "durum"]
};

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeName(value: string) {
  return normalizeSpaces(value);
}

function normalizeHeader(value: string) {
  return normalizeSpaces(
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

  for (const candidate of candidates) {
    const score = sample.split(candidate).length - 1;
    if (score > best.score) {
      best = { delimiter: candidate, score };
    }
  }

  return best.delimiter;
}

function findLikelyHeaderRowIndex(rows: ParsedLine[]) {
  for (let i = 0; i < Math.min(rows.length, 3); i += 1) {
    const headers = rows[i]?.cells.map((cell) => normalizeHeader(cell)) ?? [];
    const headerHits = headers.filter((header) =>
      Object.values(HEADER_ALIASES).some((aliases) => aliases.includes(header))
    ).length;
    if (headerHits >= 2) {
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
    email: findAliasIndex(HEADER_ALIASES.email),
    phone: findAliasIndex(HEADER_ALIASES.phone),
    role: findAliasIndex(HEADER_ALIASES.role),
    classLevel: findAliasIndex(HEADER_ALIASES.classLevel),
    instagram: findAliasIndex(HEADER_ALIASES.instagram),
    linkedin: findAliasIndex(HEADER_ALIASES.linkedin),
    outlierScore: findAliasIndex(HEADER_ALIASES.outlierScore),
    isActive: findAliasIndex(HEADER_ALIASES.isActive)
  };
}

function getCell(cells: string[], index: number) {
  if (index < 0 || index >= cells.length) {
    return "";
  }
  return normalizeSpaces(cells[index] ?? "");
}

function looksLikeHeaderCell(value: string) {
  const normalized = normalizeHeader(value);
  return Object.values(HEADER_ALIASES).some((aliases) => aliases.includes(normalized));
}

function findEmailIndex(cells: string[]) {
  for (let i = 0; i < cells.length; i += 1) {
    const value = normalizeEmail(cells[i] ?? "");
    if (EMAIL_REGEX.test(value)) {
      return i;
    }
  }
  return -1;
}

function findPhoneIndex(cells: string[]) {
  for (let i = 0; i < cells.length; i += 1) {
    const normalized = normalizePhone(cells[i] ?? "");
    if (normalized.length === 10) {
      return i;
    }
  }
  return -1;
}

function normalizeRole(value: string) {
  if (!value) return null;
  const normalized = normalizeHeader(value);

  if (normalized.includes("ogrenc") || normalized.includes("student")) return "Student";
  if (normalized.includes("akadem") || normalized.includes("academic")) return "Academic";
  if (normalized.includes("klin") || normalized.includes("hekim") || normalized.includes("doctor")) {
    return "Clinician";
  }
  if (normalized.includes("girisim") || normalized.includes("entrepreneur")) return "Entrepreneur";
  if (normalized.includes("sektor") || normalized.includes("industry")) return "Industry";
  if (HEADER_ROLE_VALUES.has(normalized)) return normalized[0]?.toUpperCase() + normalized.slice(1);

  return null;
}

function normalizeClassLevel(value: string) {
  if (!value) return null;
  const normalized = normalizeHeader(value);

  if (normalized.includes("hazirlik")) return "Hazırlık";
  if (normalized.includes("mezun") || normalized.includes("graduate")) return "Mezun";

  const digits = normalized.match(/\b([1-5])\b/);
  if (digits?.[1]) {
    return digits[1];
  }

  return null;
}

function normalizeSocial(value: string) {
  if (!value) return null;
  const trimmed = normalizeSpaces(value).replace(/^@+/, "");
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOutlierScore(value: string) {
  if (!value) return null;
  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeIsActive(value: string) {
  const normalized = normalizeHeader(value);
  if (!normalized) {
    return true;
  }

  if (
    normalized === "0" ||
    normalized.includes("pasif") ||
    normalized.includes("inactive") ||
    normalized.includes("hayir") ||
    normalized.includes("false")
  ) {
    return false;
  }

  if (
    normalized === "1" ||
    normalized.includes("aktif") ||
    normalized.includes("active") ||
    normalized.includes("evet") ||
    normalized.includes("true")
  ) {
    return true;
  }

  return true;
}

function buildParticipantNotes(participant: ParsedParticipant) {
  const notes = [
    `source:outliers_katilimci.csv`,
    participant.fullName ? `name:${participant.fullName}` : "",
    participant.role ? `role:${participant.role}` : "",
    participant.classLevel ? `class:${participant.classLevel}` : "",
    participant.instagram ? `instagram:${participant.instagram}` : "",
    participant.linkedin ? `linkedin:${participant.linkedin}` : "",
    participant.outlierScore !== null ? `outlier_score:${participant.outlierScore}` : ""
  ].filter(Boolean);

  return notes.join(" | ");
}

function parseLineWithHeaders(row: ParsedLine, headerMapping: HeaderMapping): ParsedParticipant {
  const email = normalizeEmail(getCell(row.cells, headerMapping.email));
  const phone = normalizePhone(getCell(row.cells, headerMapping.phone));
  let fullName = sanitizeName(getCell(row.cells, headerMapping.fullName));

  if (!fullName) {
    fullName =
      row.cells
        .map((cell) => sanitizeName(cell))
        .find(
          (cell) =>
            Boolean(cell) &&
            !EMAIL_REGEX.test(cell) &&
            normalizePhone(cell).length !== 10 &&
            !looksLikeHeaderCell(cell)
        ) ?? "";
  }

  return {
    line: row.line,
    raw: row.raw,
    fullName: fullName || null,
    email,
    phone,
    role: normalizeRole(getCell(row.cells, headerMapping.role)),
    classLevel: normalizeClassLevel(getCell(row.cells, headerMapping.classLevel)),
    instagram: normalizeSocial(getCell(row.cells, headerMapping.instagram)),
    linkedin: normalizeSocial(getCell(row.cells, headerMapping.linkedin)),
    outlierScore: normalizeOutlierScore(getCell(row.cells, headerMapping.outlierScore)),
    isActive: normalizeIsActive(getCell(row.cells, headerMapping.isActive))
  };
}

function parseLineWithHeuristics(row: ParsedLine): ParsedParticipant {
  const emailIndex = findEmailIndex(row.cells);
  const phoneIndex = findPhoneIndex(row.cells);
  const email = emailIndex >= 0 ? normalizeEmail(row.cells[emailIndex] ?? "") : "";
  const phone = phoneIndex >= 0 ? normalizePhone(row.cells[phoneIndex] ?? "") : "";

  const fullName =
    row.cells
      .map((cell) => sanitizeName(cell))
      .find(
        (cell, index) =>
          Boolean(cell) &&
          index !== emailIndex &&
          index !== phoneIndex &&
          !looksLikeHeaderCell(cell) &&
          !EMAIL_REGEX.test(cell)
      ) ?? "";

  const roleCell =
    row.cells
      .map((cell) => normalizeRole(cell))
      .find((value): value is string => Boolean(value)) ?? null;

  const classLevelCell =
    row.cells
      .map((cell) => normalizeClassLevel(cell))
      .find((value): value is string => Boolean(value)) ?? null;

  const instagramCell =
    row.cells
      .map((cell) => normalizeSpaces(cell))
      .find((cell) => {
        const lower = cell.toLocaleLowerCase("tr-TR");
        return (
          (lower.includes("instagram.com/") || lower.startsWith("@")) &&
          !EMAIL_REGEX.test(lower)
        );
      }) ?? "";

  const linkedinCell =
    row.cells
      .map((cell) => normalizeSpaces(cell))
      .find((cell) => {
        const lower = cell.toLocaleLowerCase("tr-TR");
        return lower.includes("linkedin.com/") || lower.includes("linkedin");
      }) ?? "";

  return {
    line: row.line,
    raw: row.raw,
    fullName: fullName || null,
    email,
    phone,
    role: roleCell,
    classLevel: classLevelCell,
    instagram: normalizeSocial(instagramCell),
    linkedin: normalizeSocial(linkedinCell),
    outlierScore: null,
    isActive: true
  };
}

function validateParticipant(participant: ParsedParticipant) {
  if (!EMAIL_REGEX.test(participant.email)) {
    return "Geçerli e-posta bulunamadı.";
  }

  if (participant.phone.length !== 10) {
    return "Telefon formatı geçersiz. Tercih: 5XXXXXXXXX. +90XXXXXXXXXX, 90XXXXXXXXXX ve 0XXXXXXXXXX otomatik 5XXXXXXXXX'e çevrilir.";
  }

  return "";
}

async function loadExistingAllowedParticipants() {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  const rows: MobileAllowedParticipantRow[] = [];

  for (let page = 0; page < 200; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("mobile_allowed_participants")
      .select("id, email, phone, is_active, notes")
      .range(from, to);

    if (error) {
      throw new Error(`Mevcut izinli katılımcılar alınamadı: ${error.message}`);
    }

    const chunk = (data ?? []) as MobileAllowedParticipantRow[];
    rows.push(...chunk);

    if (chunk.length < pageSize) {
      break;
    }
  }

  return rows;
}

export async function importMobileAllowedParticipantsFromCsv(rawCsv: string) {
  const lines = rawCsv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line, index) => ({
      line: index + 1,
      raw: line,
      normalized: line.trim()
    }))
    .filter((entry) => entry.normalized.length > 0);

  if (lines.length === 0) {
    throw new Error("Aktarılacak satır bulunamadı.");
  }

  if (lines.length > MAX_IMPORT_LINES) {
    throw new Error(`Tek seferde en fazla ${MAX_IMPORT_LINES} satır aktarabilirsiniz.`);
  }

  const delimiter = detectDelimiter(lines.map((line) => line.raw));
  const parsedLines: ParsedLine[] = lines.map((line) => ({
    line: line.line,
    raw: line.raw,
    cells: parseCsvLine(line.raw, delimiter)
  }));

  const headerRowIndex = findLikelyHeaderRowIndex(parsedLines);
  const hasHeader = headerRowIndex >= 0;
  const headerMapping = hasHeader ? getHeaderMapping(parsedLines[headerRowIndex]!.cells) : null;

  const invalidLines: InvalidLine[] = [];
  const parsedParticipants: ParsedParticipant[] = [];
  const canUseHeaderMapping = Boolean(
    headerMapping && headerMapping.email >= 0 && headerMapping.phone >= 0
  );

  for (let i = 0; i < parsedLines.length; i += 1) {
    if (i === headerRowIndex) {
      continue;
    }

    const row = parsedLines[i]!;
    const parsed = canUseHeaderMapping && headerMapping
      ? parseLineWithHeaders(row, headerMapping)
      : parseLineWithHeuristics(row);

    const validationError = validateParticipant(parsed);
    if (validationError) {
      invalidLines.push({
        line: row.line,
        value: row.raw,
        reason: validationError
      });
      continue;
    }

    parsedParticipants.push(parsed);
  }

  if (parsedParticipants.length === 0) {
    const error = new Error("Geçerli katılımcı satırı bulunamadı.");
    (error as Error & { invalid_lines?: InvalidLine[] }).invalid_lines = invalidLines.slice(0, 30);
    throw error;
  }

  const dedupedByIdentity = new Map<string, ParsedParticipant>();
  for (const participant of parsedParticipants) {
    dedupedByIdentity.set(`${participant.email}|${participant.phone}`, participant);
  }

  const dedupedParticipants = Array.from(dedupedByIdentity.values());
  const supabase = createSupabaseAdminClient();
  const existingRows = await loadExistingAllowedParticipants();

  const existingByIdentity = new Map<string, MobileAllowedParticipantRow>();
  for (const row of existingRows) {
    const key = `${normalizeEmail(row.email)}|${normalizePhone(row.phone)}`;
    existingByIdentity.set(key, row);
  }

  const insertPayload: Array<{ email: string; phone: string; is_active: boolean; notes: string }> = [];
  const updatePayload: Array<{ id: string; email: string; phone: string; is_active: boolean; notes: string }> = [];
  const sampleRows: Array<{ full_name: string; email: string; phone: string; status: "inserted" | "updated" }> = [];

  for (const participant of dedupedParticipants) {
    const identity = `${participant.email}|${participant.phone}`;
    const notes = buildParticipantNotes(participant);
    const existing = existingByIdentity.get(identity);

    if (!existing) {
      insertPayload.push({
        email: participant.email,
        phone: participant.phone,
        is_active: participant.isActive,
        notes
      });
      sampleRows.push({
        full_name: participant.fullName ?? participant.email,
        email: participant.email,
        phone: participant.phone,
        status: "inserted"
      });
      continue;
    }

    updatePayload.push({
      id: existing.id,
      email: participant.email,
      phone: participant.phone,
      is_active: participant.isActive,
      notes
    });
    sampleRows.push({
      full_name: participant.fullName ?? participant.email,
      email: participant.email,
      phone: participant.phone,
      status: "updated"
    });
  }

  if (insertPayload.length > 0) {
    const { error } = await supabase.from("mobile_allowed_participants").insert(insertPayload);
    if (error) {
      throw new Error(`Yeni katılımcılar eklenemedi: ${error.message}`);
    }
  }

  if (updatePayload.length > 0) {
    const chunkSize = 500;
    for (let start = 0; start < updatePayload.length; start += chunkSize) {
      const chunk = updatePayload.slice(start, start + chunkSize);
      const { error } = await supabase
        .from("mobile_allowed_participants")
        .upsert(chunk, { onConflict: "id", ignoreDuplicates: false });

      if (error) {
        throw new Error(`Mevcut katılımcılar güncellenemedi: ${error.message}`);
      }
    }
  }

  return {
    ok: true,
    parsed_lines: parsedParticipants.length,
    migrated_total: dedupedParticipants.length,
    inserted_count: insertPayload.length,
    updated_count: updatePayload.length,
    has_header: hasHeader,
    invalid_lines: invalidLines.slice(0, 30),
    sample_rows: sampleRows.slice(0, 20)
  };
}
