import type { Json, NetworkingProfileRow } from "@/lib/types";
import type { MobileNetworkingProfile } from "@/lib/mobile/contracts";
import type { NetworkingPublicProfile } from "@/lib/networking/contracts";

export function parseJsonStringArray(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function mapNetworkingProfileToMobile(profile: NetworkingProfileRow): MobileNetworkingProfile {
  return {
    profileId: profile.id,
    attendeeId: profile.attendee_id,
    fullName: profile.full_name,
    headline: profile.headline,
    interestArea: profile.interest_area,
    dentistryFocusAreas: parseJsonStringArray(profile.dentistry_focus_areas),
    goal: profile.goal,
    city: profile.city,
    bio: profile.bio,
    topics: parseJsonStringArray(profile.topics),
    collaborationGoals: parseJsonStringArray(profile.collaboration_goals),
    languages: parseJsonStringArray(profile.languages),
    contactInfo: profile.contact_info
  };
}

export function mapPublicNetworkingProfileToMobile(
  profile: NetworkingPublicProfile,
  attendeeId: string | null
): MobileNetworkingProfile {
  return {
    profileId: profile.id,
    attendeeId,
    fullName: profile.full_name,
    headline: profile.headline,
    interestArea: profile.interest_area,
    dentistryFocusAreas: profile.dentistry_focus_areas,
    goal: profile.goal,
    city: profile.city,
    bio: profile.bio,
    topics: profile.topics,
    collaborationGoals: profile.collaboration_goals,
    languages: profile.languages,
    contactInfo: profile.contact_info,
    matchScore: profile.match_score,
    matchReasons: profile.match_reasons
  };
}
