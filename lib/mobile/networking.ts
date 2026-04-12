import { buildContactInfo } from "@/lib/networking-contact";
import {
  NETWORKING_FUTURE_PATH_OPTIONS,
  NETWORKING_INTEREST_OPTIONS,
  NETWORKING_LANGUAGE_OPTIONS
} from "@/lib/networking/contracts";
import type { MobileSession } from "@/lib/mobile/auth";
import type { Database, NetworkingProfileRow } from "@/lib/types";

type NetworkingProfileInsert = Database["public"]["Tables"]["networking_profiles"]["Insert"];

export type MinimalNetworkingProfileRow = Pick<
  NetworkingProfileRow,
  | "id"
  | "attendee_id"
  | "full_name"
  | "headline"
  | "interest_area"
  | "goal"
  | "city"
  | "bio"
  | "topics"
  | "collaboration_goals"
  | "languages"
  | "contact_info"
  | "is_visible"
  | "last_active_at"
  | "profile_completion_score"
  | "created_at"
>;

export const NETWORKING_PROFILE_COLUMNS =
  "id, attendee_id, full_name, headline, interest_area, goal, city, bio, topics, collaboration_goals, languages, contact_info, is_visible, last_active_at, profile_completion_score, created_at";

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
}

function buildDefaultProfileInsert(session: MobileSession): NetworkingProfileInsert | null {
  const attendee = session.attendee;
  if (!attendee) {
    return null;
  }

  const instagram = attendee.instagram ?? "";
  const linkedin = attendee.linkedin ?? "";

  return {
    attendee_id: attendee.id,
    full_name: attendee.name,
    headline: attendee.role,
    interest_area: NETWORKING_INTEREST_OPTIONS[0],
    goal: NETWORKING_FUTURE_PATH_OPTIONS[2] ?? NETWORKING_FUTURE_PATH_OPTIONS[0],
    city: null,
    institution_name: attendee.university ?? null,
    bio: null,
    topics: [],
    collaboration_goals: [],
    languages: [NETWORKING_LANGUAGE_OPTIONS[0]],
    contact_info: buildContactInfo(instagram, linkedin),
    is_visible: true,
    profile_completion_score: 28,
    last_active_at: new Date().toISOString()
  };
}

export function toMinimalNetworkingProfileRow(value: unknown): MinimalNetworkingProfileRow {
  return value as MinimalNetworkingProfileRow;
}

export async function getNetworkingProfileByAttendeeId(session: MobileSession) {
  if (!session.attendee?.id) {
    return null;
  }

  const { data, error } = await session.supabase
    .from("networking_profiles")
    .select(NETWORKING_PROFILE_COLUMNS)
    .eq("attendee_id", session.attendee.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Networking profili alınamadı: ${error.message}`);
  }

  return data ? toMinimalNetworkingProfileRow(data) : null;
}

export async function ensureNetworkingProfileForSession(session: MobileSession) {
  if (!session.attendee?.id) {
    return null;
  }

  const existing = await getNetworkingProfileByAttendeeId(session);
  if (existing) {
    return existing;
  }

  // Legacy backfill pass by exact normalized name.
  const attendeeName = normalizeName(session.attendee.name);
  if (attendeeName) {
    const { data: candidates, error: candidateError } = await session.supabase
      .from("networking_profiles")
      .select(NETWORKING_PROFILE_COLUMNS)
      .is("attendee_id", null)
      .order("created_at", { ascending: false })
      .limit(120);

    if (candidateError) {
      throw new Error(`Legacy networking profil eşleşmesi alınamadı: ${candidateError.message}`);
    }

    const matchedCandidate = (candidates ?? [])
      .map(toMinimalNetworkingProfileRow)
      .find((candidate) => normalizeName(candidate.full_name) === attendeeName);

    if (matchedCandidate) {
      const { data: linked, error: linkError } = await session.supabase
        .from("networking_profiles")
        .update({
          attendee_id: session.attendee.id,
          contact_info: buildContactInfo(session.attendee.instagram ?? "", session.attendee.linkedin ?? ""),
          last_active_at: new Date().toISOString()
        })
        .eq("id", matchedCandidate.id)
        .select(NETWORKING_PROFILE_COLUMNS)
        .maybeSingle();

      if (linkError) {
        throw new Error(`Networking profili katılımcıya bağlanamadı: ${linkError.message}`);
      }

      if (linked) {
        return toMinimalNetworkingProfileRow(linked);
      }
    }
  }

  const insertPayload = buildDefaultProfileInsert(session);
  if (!insertPayload) {
    return null;
  }

  const { data: created, error: createError } = await session.supabase
    .from("networking_profiles")
    .insert(insertPayload)
    .select(NETWORKING_PROFILE_COLUMNS)
    .single();

  if (createError) {
    throw new Error(`Networking profili oluşturulamadı: ${createError.message}`);
  }

  return toMinimalNetworkingProfileRow(created);
}

export async function getNetworkingProfilesByIds(session: MobileSession, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map<string, MinimalNetworkingProfileRow>();
  }

  const { data, error } = await session.supabase
    .from("networking_profiles")
    .select(NETWORKING_PROFILE_COLUMNS)
    .in("id", uniqueIds);

  if (error) {
    throw new Error(`Networking profil detayları alınamadı: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => {
    const profile = toMinimalNetworkingProfileRow(row);
    return [profile.id, profile] as const;
  }));
}

export async function upsertAcceptedMatchFromProfileIds(
  session: MobileSession,
  actorProfileId: string,
  targetProfileId: string
) {
  const profileById = await getNetworkingProfilesByIds(session, [actorProfileId, targetProfileId]);
  const actorProfile = profileById.get(actorProfileId) ?? null;
  const targetProfile = profileById.get(targetProfileId) ?? null;

  const actorAttendeeId = actorProfile?.attendee_id ?? null;
  const targetAttendeeId = targetProfile?.attendee_id ?? null;

  if (!actorAttendeeId || !targetAttendeeId || actorAttendeeId === targetAttendeeId) {
    return null;
  }

  const [attendeeA, attendeeB] = [actorAttendeeId, targetAttendeeId].sort((first, second) =>
    first.localeCompare(second)
  );

  const { data, error } = await session.supabase
    .from("matches")
    .upsert(
      {
        attendee_a: attendeeA,
        attendee_b: attendeeB,
        status: "accepted"
      },
      {
        onConflict: "attendee_a,attendee_b"
      }
    )
    .select("id, attendee_a, attendee_b, status, created_at")
    .single();

  if (error) {
    throw new Error(`Eşleşme kaydı oluşturulamadı: ${error.message}`);
  }

  return data;
}

export async function hasAcceptedMatch(
  session: MobileSession,
  attendeeId: string,
  counterpartId: string
) {
  const [attendeeA, attendeeB] = [attendeeId, counterpartId].sort((first, second) =>
    first.localeCompare(second)
  );

  const { data, error } = await session.supabase
    .from("matches")
    .select("id")
    .eq("attendee_a", attendeeA)
    .eq("attendee_b", attendeeB)
    .eq("status", "accepted")
    .maybeSingle();

  if (error) {
    throw new Error(`Eşleşme doğrulaması yapılamadı: ${error.message}`);
  }

  return Boolean(data?.id);
}
