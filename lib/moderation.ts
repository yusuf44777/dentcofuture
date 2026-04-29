import type { MobileSession } from "@/lib/mobile/auth";
import type { Json } from "@/lib/types";

export const MODERATION_TARGET_TYPES = [
  "gallery_post",
  "gallery_comment",
  "networking_profile",
  "live_question"
] as const;

export type ModerationTargetType = (typeof MODERATION_TARGET_TYPES)[number];

export class ObjectionableContentError extends Error {
  code = "OBJECTIONABLE_CONTENT";

  constructor(message: string) {
    super(message);
    this.name = "ObjectionableContentError";
  }
}

type ModerationMatch = {
  category: "abuse" | "hate" | "sexual" | "violence" | "spam";
  pattern: RegExp;
};

const MODERATION_MATCHES: ModerationMatch[] = [
  { category: "abuse", pattern: /\b(fuck|shit|bitch|asshole|bastard|cunt)\b/i },
  { category: "abuse", pattern: /\b(siktir|amk|aq|orospu|pi[cç]|yav[sş]ak|g[oö]t|mal)\b/i },
  { category: "hate", pattern: /\b(nazi|racist|ırk[cç][ıi]|ter[oö]rist)\b/i },
  { category: "violence", pattern: /\b(kill yourself|kys|i will kill|seni [oö]ld[uü]r|gebert)\b/i },
  { category: "sexual", pattern: /\b(porn|porno|nude|naked|sex|escort)\b/i },
  { category: "spam", pattern: /\b(bit\.ly|tinyurl\.com|t\.me\/|whatsapp group|free money)\b/i }
];

const REPEATED_LINK_PATTERN = /(https?:\/\/|www\.)/gi;

function normalizeModerationText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^\w\s./:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isModerationTargetType(value: unknown): value is ModerationTargetType {
  return MODERATION_TARGET_TYPES.includes(value as ModerationTargetType);
}

export function moderateUserGeneratedText(value: string) {
  const normalized = normalizeModerationText(value);
  if (!normalized) {
    return { allowed: true as const };
  }

  const linkMatches = normalized.match(REPEATED_LINK_PATTERN);
  if (linkMatches && linkMatches.length > 2) {
    return { allowed: false as const, category: "spam" as const };
  }

  const match = MODERATION_MATCHES.find((candidate) => candidate.pattern.test(normalized));
  if (match) {
    return { allowed: false as const, category: match.category };
  }

  return { allowed: true as const };
}

export function assertUserGeneratedTextAllowed(value: string, label: string) {
  const result = moderateUserGeneratedText(value);
  if (result.allowed) {
    return;
  }

  throw new ObjectionableContentError(
    `${label} topluluk kurallarına aykırı görünüyor. Lütfen hakaret, tehdit, cinsel içerik, nefret söylemi veya spam içermeyen bir metin girin.`
  );
}

function isMissingModerationTableError(error: { code?: string; message?: string }) {
  const message = (error.message ?? "").toLowerCase();
  return error.code === "42P01" || message.includes("does not exist");
}

async function notifyModerationTeam(input: {
  reportId: string;
  reporterAttendeeId: string;
  targetAttendeeId?: string | null;
  targetType: ModerationTargetType;
  targetId?: string | null;
  action: "report" | "block" | "auto_filter";
  reason: string;
}) {
  const payload = {
    ...input,
    createdAt: new Date().toISOString(),
    message: "A mobile moderation report requires review within 24 hours."
  };

  const webhookUrl = process.env.MODERATION_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn("Moderation report created", payload);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    console.error("Moderation webhook notification failed", error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getBlockedAttendeeIds(session: MobileSession) {
  const attendeeId = session.attendee?.id;
  if (!attendeeId) {
    return new Set<string>();
  }

  const { data, error } = await session.supabase
    .from("user_blocks")
    .select("blocked_attendee_id")
    .eq("blocker_attendee_id", attendeeId);

  if (error) {
    if (isMissingModerationTableError(error)) {
      console.warn("Moderation tables are missing; blocked users cannot be filtered yet.");
      return new Set<string>();
    }

    throw new Error(`Engellenen kullanıcılar alınamadı: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.blocked_attendee_id).filter(Boolean));
}

export async function createContentReport(
  session: MobileSession,
  input: {
    targetType: ModerationTargetType;
    targetId?: string | null;
    targetAttendeeId?: string | null;
    reason: string;
    action: "report" | "block" | "auto_filter";
    details?: Json;
  }
) {
  const reporterAttendeeId = session.attendee?.id;
  if (!reporterAttendeeId) {
    throw new Error("Rapor oluşturmak için onboarding tamamlanmalı.");
  }

  const { data, error } = await session.supabase
    .from("content_reports")
    .insert({
      reporter_attendee_id: reporterAttendeeId,
      target_attendee_id: input.targetAttendeeId ?? null,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      action: input.action,
      reason: input.reason.slice(0, 240),
      details: input.details ?? {}
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Rapor kaydedilemedi: ${error?.message ?? "Bilinmeyen hata"}`);
  }

  const reportId = data.id as string;
  await notifyModerationTeam({
    reportId,
    reporterAttendeeId,
    targetAttendeeId: input.targetAttendeeId ?? null,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    action: input.action,
    reason: input.reason.slice(0, 240)
  });

  return reportId;
}

export async function blockAttendee(
  session: MobileSession,
  input: {
    blockedAttendeeId: string;
    targetType: ModerationTargetType;
    targetId?: string | null;
    reason: string;
    details?: Json;
  }
) {
  const blockerAttendeeId = session.attendee?.id;
  if (!blockerAttendeeId) {
    throw new Error("Kullanıcı engellemek için onboarding tamamlanmalı.");
  }

  if (blockerAttendeeId === input.blockedAttendeeId) {
    throw new Error("Kendi hesabını engelleyemezsin.");
  }

  const reportId = await createContentReport(session, {
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    targetAttendeeId: input.blockedAttendeeId,
    reason: input.reason,
    action: "block",
    details: input.details
  });

  const { data, error } = await session.supabase
    .from("user_blocks")
    .upsert(
      {
        blocker_attendee_id: blockerAttendeeId,
        blocked_attendee_id: input.blockedAttendeeId,
        reason: input.reason.slice(0, 240),
        source_report_id: reportId
      },
      {
        onConflict: "blocker_attendee_id,blocked_attendee_id"
      }
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Kullanıcı engellenemedi: ${error?.message ?? "Bilinmeyen hata"}`);
  }

  return {
    blockId: data.id as string,
    reportId
  };
}
