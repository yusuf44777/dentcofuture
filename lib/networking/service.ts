import type { Database, Json } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildContactInfo } from "@/lib/networking-contact";
import {
  NETWORKING_AVAILABILITY_OPTIONS,
  NETWORKING_COLLABORATION_GOAL_OPTIONS,
  NETWORKING_FUTURE_PATH_OPTIONS,
  NETWORKING_INTEREST_OPTIONS,
  NETWORKING_LANGUAGE_OPTIONS,
  NETWORKING_MAX_GOAL_COUNT,
  NETWORKING_MAX_LANGUAGE_COUNT,
  NETWORKING_MAX_TOPIC_COUNT,
  NETWORKING_PROFESSION_OPTIONS,
  NETWORKING_TOPIC_OPTIONS,
  type NetworkingFeedResponse,
  type NetworkingInteractionAction,
  type NetworkingMatchRecord,
  type NetworkingMatchesResponse,
  type NetworkingProfileInput,
  type NetworkingPublicProfile
} from "@/lib/networking/contracts";

type NetworkingProfileRow = Database["public"]["Tables"]["networking_profiles"]["Row"];
type NetworkingProfileActionRow = Database["public"]["Tables"]["networking_profile_actions"]["Row"];
type NetworkingProfileInsert = Database["public"]["Tables"]["networking_profiles"]["Insert"];
type NetworkingProfileUpdate = Database["public"]["Tables"]["networking_profiles"]["Update"];

const NETWORKING_PUBLIC_PROFILE_COLUMNS = `
  id,
  full_name,
  headline,
  interest_area,
  goal,
  profession,
  city,
  institution_name,
  years_experience,
  bio,
  topics,
  collaboration_goals,
  languages,
  availability,
  contact_info,
  is_visible,
  profile_completion_score,
  last_active_at,
  created_at
`;

const INTEREST_OPTION_SET = new Set<string>(NETWORKING_INTEREST_OPTIONS);
const FUTURE_PATH_OPTION_SET = new Set<string>(NETWORKING_FUTURE_PATH_OPTIONS);
const PROFESSION_OPTION_SET = new Set<string>(NETWORKING_PROFESSION_OPTIONS);
const TOPIC_OPTION_SET = new Set<string>(NETWORKING_TOPIC_OPTIONS);
const GOAL_OPTION_SET = new Set<string>(NETWORKING_COLLABORATION_GOAL_OPTIONS);
const LANGUAGE_OPTION_SET = new Set<string>(NETWORKING_LANGUAGE_OPTIONS);
const AVAILABILITY_OPTION_SET = new Set<string>(NETWORKING_AVAILABILITY_OPTIONS);

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOptionalText(value: string) {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : "";
}

function parseInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function normalizeStringArray(
  value: unknown,
  options: Set<string>,
  maxItems: number
) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const normalizedValues = value
    .map((item) => (typeof item === "string" ? normalizeText(item) : ""))
    .filter(Boolean)
    .filter((item) => options.has(item));

  return Array.from(new Set(normalizedValues)).slice(0, maxItems);
}

function parseJsonStringArray(value: Json | null) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function toNullable(value: string) {
  return value.length > 0 ? value : null;
}

function calculateProfileCompleteness(input: NetworkingProfileInput) {
  const checks = [
    input.fullName.length > 1,
    input.interestArea.length > 0,
    input.futurePath.length > 0,
    input.profession.length > 0,
    input.headline.length > 0,
    input.city.length > 0,
    input.institutionName.length > 0,
    typeof input.yearsExperience === "number",
    input.bio.length > 0,
    input.topics.length > 0,
    input.collaborationGoals.length > 0,
    input.languages.length > 0,
    input.availability.length > 0,
    input.instagram.length > 0 || input.linkedin.length > 0
  ];

  const completedFields = checks.filter(Boolean).length;
  return Math.round((completedFields / checks.length) * 100);
}

export function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeNetworkingProfileInput(raw: Record<string, unknown>) {
  const fullName = normalizeText(typeof raw.fullName === "string" ? raw.fullName : "");
  const headline = normalizeOptionalText(typeof raw.headline === "string" ? raw.headline : "");
  const interestArea = normalizeText(
    typeof raw.interestArea === "string" ? raw.interestArea : ""
  );
  const futurePath = normalizeText(
    typeof raw.futurePath === "string"
      ? raw.futurePath
      : typeof raw.goal === "string"
        ? raw.goal
        : ""
  );
  const profession = normalizeText(
    typeof raw.profession === "string" ? raw.profession : ""
  );
  const city = normalizeOptionalText(typeof raw.city === "string" ? raw.city : "");
  const institutionName = normalizeOptionalText(
    typeof raw.institutionName === "string" ? raw.institutionName : ""
  );
  const yearsExperience = parseInteger(raw.yearsExperience);
  const bio = normalizeOptionalText(typeof raw.bio === "string" ? raw.bio : "");
  const topics = normalizeStringArray(raw.topics, TOPIC_OPTION_SET, NETWORKING_MAX_TOPIC_COUNT);
  const collaborationGoals = normalizeStringArray(
    raw.collaborationGoals,
    GOAL_OPTION_SET,
    NETWORKING_MAX_GOAL_COUNT
  );
  const languages = normalizeStringArray(
    raw.languages,
    LANGUAGE_OPTION_SET,
    NETWORKING_MAX_LANGUAGE_COUNT
  );
  const availability = normalizeText(
    typeof raw.availability === "string" ? raw.availability : ""
  );
  const instagram = typeof raw.instagram === "string" ? raw.instagram : "";
  const linkedin = typeof raw.linkedin === "string" ? raw.linkedin : "";
  const isVisible = parseBoolean(raw.isVisible, true);

  const errors: string[] = [];

  if (fullName.length < 2 || fullName.length > 120) {
    errors.push("Ad soyad alani gecersiz.");
  }

  if (!INTEREST_OPTION_SET.has(interestArea)) {
    errors.push("Ana uzmanlik alani secimi gecersiz.");
  }

  if (!FUTURE_PATH_OPTION_SET.has(futurePath)) {
    errors.push("Kariyer yonu secimi gecersiz.");
  }

  if (profession && !PROFESSION_OPTION_SET.has(profession)) {
    errors.push("Mesleki rol secimi gecersiz.");
  }

  if (headline.length > 120) {
    errors.push("Unvan alani cok uzun.");
  }

  if (city.length > 80) {
    errors.push("Sehir alani cok uzun.");
  }

  if (institutionName.length > 120) {
    errors.push("Kurum veya klinik alani cok uzun.");
  }

  if (typeof yearsExperience === "number" && (yearsExperience < 0 || yearsExperience > 60)) {
    errors.push("Deneyim yili 0 ile 60 arasinda olmali.");
  }

  if (bio.length > 320) {
    errors.push("Kisa tanitim alani 320 karakteri gecemez.");
  }

  if (availability && !AVAILABILITY_OPTION_SET.has(availability)) {
    errors.push("Gorusme uygunlugu secimi gecersiz.");
  }

  const input: NetworkingProfileInput = {
    fullName,
    headline,
    interestArea,
    futurePath,
    profession,
    city,
    institutionName,
    yearsExperience,
    bio,
    topics,
    collaborationGoals,
    languages,
    availability,
    instagram,
    linkedin,
    isVisible
  };

  return { input, errors };
}

export function mapNetworkingProfileRow(row: NetworkingProfileRow): NetworkingPublicProfile {
  return {
    id: row.id,
    full_name: row.full_name,
    headline: row.headline,
    interest_area: row.interest_area,
    goal: row.goal,
    profession: row.profession,
    city: row.city,
    institution_name: row.institution_name,
    years_experience: row.years_experience,
    bio: row.bio,
    topics: parseJsonStringArray(row.topics),
    collaboration_goals: parseJsonStringArray(row.collaboration_goals),
    languages: parseJsonStringArray(row.languages),
    availability: row.availability,
    contact_info: row.contact_info,
    is_visible: row.is_visible,
    profile_completion_score: row.profile_completion_score,
    last_active_at: row.last_active_at,
    created_at: row.created_at
  };
}

function buildNetworkingPayload(input: NetworkingProfileInput): NetworkingProfileInsert {
  return {
    full_name: input.fullName,
    headline: toNullable(input.headline),
    interest_area: input.interestArea,
    goal: input.futurePath,
    profession: toNullable(input.profession),
    city: toNullable(input.city),
    institution_name: toNullable(input.institutionName),
    years_experience: input.yearsExperience,
    bio: toNullable(input.bio),
    topics: input.topics,
    collaboration_goals: input.collaborationGoals,
    languages: input.languages,
    availability: toNullable(input.availability),
    contact_info: buildContactInfo(input.instagram, input.linkedin),
    is_visible: input.isVisible,
    profile_completion_score: calculateProfileCompleteness(input),
    last_active_at: new Date().toISOString()
  };
}

function buildNetworkingUpdatePayload(input: NetworkingProfileInput): NetworkingProfileUpdate {
  return buildNetworkingPayload(input);
}

export async function getNetworkingProfileById(profileId: string, touchProfile = false) {
  const supabase = createSupabaseAdminClient();

  if (touchProfile) {
    const { data, error } = await supabase
      .from("networking_profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", profileId)
      .select(NETWORKING_PUBLIC_PROFILE_COLUMNS)
      .maybeSingle();

    if (error) {
      throw new Error(`Profil okunamadi: ${error.message}`);
    }

    return data ? mapNetworkingProfileRow(data as NetworkingProfileRow) : null;
  }

  const { data, error } = await supabase
    .from("networking_profiles")
    .select(NETWORKING_PUBLIC_PROFILE_COLUMNS)
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Profil okunamadi: ${error.message}`);
  }

  return data ? mapNetworkingProfileRow(data as NetworkingProfileRow) : null;
}

export async function createNetworkingProfile(input: NetworkingProfileInput) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("networking_profiles")
    .insert(buildNetworkingPayload(input))
    .select(NETWORKING_PUBLIC_PROFILE_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Profil olusturulamadi: ${error.message}`);
  }

  return mapNetworkingProfileRow(data as NetworkingProfileRow);
}

export async function updateNetworkingProfile(profileId: string, input: NetworkingProfileInput) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("networking_profiles")
    .update(buildNetworkingUpdatePayload(input))
    .eq("id", profileId)
    .select(NETWORKING_PUBLIC_PROFILE_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Profil guncellenemedi: ${error.message}`);
  }

  return data ? mapNetworkingProfileRow(data as NetworkingProfileRow) : null;
}

function getSharedItems(first: string[], second: string[]) {
  const secondSet = new Set(second);
  return first.filter((item) => secondSet.has(item));
}

function getHoursSince(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  return diffMs / (1000 * 60 * 60);
}

function scoreProfileMatch(currentProfile: NetworkingPublicProfile, candidate: NetworkingPublicProfile) {
  let score = 0;
  const reasons: string[] = [];

  if (candidate.interest_area === currentProfile.interest_area) {
    score += 32;
    reasons.push(`${candidate.interest_area} odaği ortak`);
  }

  if (candidate.goal === currentProfile.goal) {
    score += 16;
    reasons.push(`${candidate.goal} kariyer yonu uyumlu`);
  }

  const sharedTopics = getSharedItems(currentProfile.topics, candidate.topics);
  if (sharedTopics.length > 0) {
    score += Math.min(sharedTopics.length * 8, 24);
    reasons.push(`Ortak ilgi: ${sharedTopics.slice(0, 2).join(", ")}`);
  }

  const sharedCollaborationGoals = getSharedItems(
    currentProfile.collaboration_goals,
    candidate.collaboration_goals
  );
  if (sharedCollaborationGoals.length > 0) {
    score += Math.min(sharedCollaborationGoals.length * 10, 20);
    reasons.push(`Benzer hedef: ${sharedCollaborationGoals.slice(0, 2).join(", ")}`);
  }

  const sharedLanguages = getSharedItems(currentProfile.languages, candidate.languages);
  if (sharedLanguages.length > 0) {
    score += Math.min(sharedLanguages.length * 4, 8);
    reasons.push(`Ortak dil: ${sharedLanguages.slice(0, 2).join(", ")}`);
  }

  if (currentProfile.city && candidate.city && currentProfile.city === candidate.city) {
    score += 8;
    reasons.push(`${candidate.city} lokasyonu ortak`);
  }

  if (
    typeof currentProfile.years_experience === "number" &&
    typeof candidate.years_experience === "number"
  ) {
    const yearGap = Math.abs(currentProfile.years_experience - candidate.years_experience);
    if (yearGap <= 2) {
      score += 6;
    } else if (yearGap <= 5) {
      score += 3;
    }
  }

  if (
    currentProfile.availability &&
    candidate.availability &&
    currentProfile.availability === candidate.availability
  ) {
    score += 4;
  }

  if (candidate.contact_info) {
    score += 4;
  }

  if (candidate.profile_completion_score >= 70) {
    score += 6;
  } else if (candidate.profile_completion_score >= 40) {
    score += 3;
  }

  const hoursSinceLastActive = getHoursSince(candidate.last_active_at);
  if (hoursSinceLastActive <= 1) {
    score += 6;
    reasons.push("Yakinda aktifti");
  } else if (hoursSinceLastActive <= 8) {
    score += 3;
  }

  return {
    ...candidate,
    match_score: score,
    match_reasons: reasons.slice(0, 3)
  };
}

function buildDiscoveryMessage(recommendedCount: number, otherCount: number) {
  if (recommendedCount === 0 && otherCount === 0) {
    return "Su an baska gorunur profil yok. Yeni katilimcilar geldikce liste yenilenir.";
  }

  if (recommendedCount > 0 && otherCount > 0) {
    return `${recommendedCount} guclu eslesme ve ${otherCount} ek profil hazirlandi.`;
  }

  if (recommendedCount > 0) {
    return `${recommendedCount} guclu eslesme bulundu.`;
  }

  return `${otherCount} profil listelendi, ama su an cok guclu bir eslesme yok.`;
}

function buildFeedMessage(candidateCount: number, matchCount: number) {
  if (candidateCount === 0 && matchCount === 0) {
    return "Kart havuzu simdilik bos. Yeni profiller geldikce burada goreceksin.";
  }

  if (candidateCount === 0 && matchCount > 0) {
    return `${matchCount} karsilikli eslesmen var. Yeni profiller geldiginde besleme tekrar dolar.`;
  }

  return `${candidateCount} yeni profil hazir. Karsilikli ilgi olursa eslesmeler sekmesine duser.`;
}

function buildMatchRecord(profile: NetworkingPublicProfile, matchedAt: string): NetworkingMatchRecord {
  return {
    profile,
    matchedAt
  };
}

async function getNetworkingActionsForActor(actorProfileId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("networking_profile_actions")
    .select("id, actor_profile_id, target_profile_id, action, created_at, updated_at")
    .eq("actor_profile_id", actorProfileId);

  if (error) {
    throw new Error(`Profil aksiyonlari okunamadi: ${error.message}`);
  }

  return (data ?? []) as NetworkingProfileActionRow[];
}

async function getMutualMatchRecords(profileId: string, currentProfile: NetworkingPublicProfile) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("networking_profile_actions")
    .select("id, actor_profile_id, target_profile_id, action, created_at, updated_at")
    .or(`actor_profile_id.eq.${profileId},target_profile_id.eq.${profileId}`)
    .eq("action", "like");

  if (error) {
    throw new Error(`Eslesme aksiyonlari okunamadi: ${error.message}`);
  }

  const likeRows = (data ?? []) as NetworkingProfileActionRow[];
  const sentLikes = likeRows.filter((row) => row.actor_profile_id === profileId);
  const receivedLikes = likeRows.filter((row) => row.target_profile_id === profileId);
  const sentLikeByTarget = new Map(sentLikes.map((row) => [row.target_profile_id, row]));
  const matchedCounterparts = receivedLikes
    .filter((row) => sentLikeByTarget.has(row.actor_profile_id))
    .map((row) => {
      const sentRow = sentLikeByTarget.get(row.actor_profile_id)!;
      return {
        counterpartId: row.actor_profile_id,
        matchedAt:
          new Date(sentRow.updated_at).getTime() > new Date(row.updated_at).getTime()
            ? sentRow.updated_at
            : row.updated_at
      };
    });

  if (matchedCounterparts.length === 0) {
    return [] as NetworkingMatchRecord[];
  }

  const counterpartIds = matchedCounterparts.map((item) => item.counterpartId);
  const { data: profileData, error: profileError } = await supabase
    .from("networking_profiles")
    .select(NETWORKING_PUBLIC_PROFILE_COLUMNS)
    .in("id", counterpartIds)
    .eq("is_visible", true);

  if (profileError) {
    throw new Error(`Eslesen profiller okunamadi: ${profileError.message}`);
  }

  const counterpartProfiles = ((profileData ?? []) as NetworkingProfileRow[]).map(mapNetworkingProfileRow);
  const counterpartById = new Map(
    counterpartProfiles.map((profile) => [profile.id, scoreProfileMatch(currentProfile, profile)])
  );

  return matchedCounterparts
    .map((item) => {
      const profile = counterpartById.get(item.counterpartId);
      return profile ? buildMatchRecord(profile, item.matchedAt) : null;
    })
    .filter((item): item is NetworkingMatchRecord => Boolean(item))
    .sort((first, second) => new Date(second.matchedAt).getTime() - new Date(first.matchedAt).getTime());
}

export async function getNetworkingDiscovery(profileId: string) {
  const currentProfile = await getNetworkingProfileById(profileId, true);

  if (!currentProfile) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("networking_profiles")
    .select(NETWORKING_PUBLIC_PROFILE_COLUMNS)
    .neq("id", profileId)
    .eq("is_visible", true)
    .order("last_active_at", { ascending: false })
    .limit(80);

  if (error) {
    throw new Error(`Networking profilleri okunamadi: ${error.message}`);
  }

  const profiles = ((data ?? []) as NetworkingProfileRow[]).map(mapNetworkingProfileRow);
  const scoredProfiles = profiles
    .map((candidate) => scoreProfileMatch(currentProfile, candidate))
    .sort((first, second) => {
      const scoreGap = (second.match_score ?? 0) - (first.match_score ?? 0);
      if (scoreGap !== 0) {
        return scoreGap;
      }

      return new Date(second.last_active_at).getTime() - new Date(first.last_active_at).getTime();
    });

  const recommendedProfiles = scoredProfiles.filter((profile) => (profile.match_score ?? 0) >= 35);
  const otherProfiles = scoredProfiles.filter((profile) => (profile.match_score ?? 0) < 35);

  return {
    status:
      recommendedProfiles.length > 0 || otherProfiles.length > 0 ? ("found" as const) : ("waiting" as const),
    currentProfile,
    recommendedProfiles: recommendedProfiles.slice(0, 8),
    similarProfiles: recommendedProfiles.slice(0, 8),
    otherProfiles: otherProfiles.slice(0, 24),
    message: buildDiscoveryMessage(recommendedProfiles.length, otherProfiles.length),
    refreshedAt: new Date().toISOString()
  };
}

export function isValidNetworkingInteractionAction(value: string): value is NetworkingInteractionAction {
  return value === "like" || value === "pass";
}

export async function getNetworkingFeed(profileId: string): Promise<NetworkingFeedResponse | null> {
  const currentProfile = await getNetworkingProfileById(profileId, true);

  if (!currentProfile) {
    return null;
  }

  const actorActions = await getNetworkingActionsForActor(profileId);
  const actedTargetIds = actorActions.map((row) => row.target_profile_id);
  const likesSentCount = actorActions.filter((row) => row.action === "like").length;
  const matches = await getMutualMatchRecords(profileId, currentProfile);

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("networking_profiles")
    .select(NETWORKING_PUBLIC_PROFILE_COLUMNS)
    .neq("id", profileId)
    .eq("is_visible", true)
    .order("last_active_at", { ascending: false })
    .limit(60);

  if (actedTargetIds.length > 0) {
    query = query.not(
      "id",
      "in",
      `(${actedTargetIds.map((id) => `"${id}"`).join(",")})`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Kart havuzu okunamadi: ${error.message}`);
  }

  const queue = ((data ?? []) as NetworkingProfileRow[])
    .map(mapNetworkingProfileRow)
    .map((candidate) => scoreProfileMatch(currentProfile, candidate))
    .sort((first, second) => {
      const scoreGap = (second.match_score ?? 0) - (first.match_score ?? 0);
      if (scoreGap !== 0) {
        return scoreGap;
      }

      return new Date(second.last_active_at).getTime() - new Date(first.last_active_at).getTime();
    })
    .slice(0, 24);

  return {
    status: queue.length > 0 ? "ready" : "empty",
    currentProfile,
    queue,
    likesSentCount,
    mutualMatchesCount: matches.length,
    message: buildFeedMessage(queue.length, matches.length),
    refreshedAt: new Date().toISOString()
  };
}

export async function createNetworkingInteraction(input: {
  actorProfileId: string;
  targetProfileId: string;
  action: NetworkingInteractionAction;
}) {
  const { actorProfileId, targetProfileId, action } = input;
  const currentProfile = await getNetworkingProfileById(actorProfileId, true);

  if (!currentProfile) {
    throw new Error("Aksiyon sahibi profil bulunamadi.");
  }

  const targetProfile = await getNetworkingProfileById(targetProfileId);
  if (!targetProfile || !targetProfile.is_visible) {
    throw new Error("Etkilesime acik hedef profil bulunamadi.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("networking_profile_actions")
    .upsert(
      {
        actor_profile_id: actorProfileId,
        target_profile_id: targetProfileId,
        action,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "actor_profile_id,target_profile_id"
      }
    );

  if (error) {
    throw new Error(`Profil aksiyonu kaydedilemedi: ${error.message}`);
  }

  let match: NetworkingMatchRecord | undefined;

  if (action === "like") {
    const { data: reverseLike, error: reverseLikeError } = await supabase
      .from("networking_profile_actions")
      .select("id, updated_at")
      .eq("actor_profile_id", targetProfileId)
      .eq("target_profile_id", actorProfileId)
      .eq("action", "like")
      .maybeSingle();

    if (reverseLikeError) {
      throw new Error(`Karsilikli ilgi kontrolu yapilamadi: ${reverseLikeError.message}`);
    }

    if (reverseLike?.id) {
      match = buildMatchRecord(
        scoreProfileMatch(currentProfile, targetProfile),
        reverseLike.updated_at
      );
    }
  }

  return {
    ok: true,
    action,
    actorProfileId,
    targetProfileId,
    matched: Boolean(match),
    match
  };
}

export async function getNetworkingMatches(profileId: string): Promise<NetworkingMatchesResponse | null> {
  const currentProfile = await getNetworkingProfileById(profileId, true);

  if (!currentProfile) {
    return null;
  }

  const matches = await getMutualMatchRecords(profileId, currentProfile);

  return {
    ok: true,
    currentProfile,
    matches,
    total: matches.length,
    refreshedAt: new Date().toISOString()
  };
}
