import type { Json, NetworkingProfileRow } from "@/lib/types";
import type { MobileNetworkingProfile } from "@/lib/mobile/contracts";
import type { NetworkingPublicProfile } from "@/lib/networking/contracts";

type MobileLinkedAttendeeMeta = {
  role?: string | null;
  classLevel?: string | null;
  university?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
};

export function parseJsonStringArray(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function mapNetworkingProfileToMobile(profile: NetworkingProfileRow): MobileNetworkingProfile {
  return {
    profileId: profile.id,
    attendeeId: profile.attendee_id,
    attendeeRole: null,
    attendeeClassLevel: null,
    university: null,
    fullName: profile.full_name,
    headline: profile.headline,
    interestArea: profile.interest_area,
    dentistryFocusAreas: parseJsonStringArray(profile.dentistry_focus_areas),
    goal: profile.goal,
    institutionName: profile.institution_name,
    instagram: null,
    linkedin: null,
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
  attendeeId: string | null,
  attendeeMeta?: MobileLinkedAttendeeMeta | null
): MobileNetworkingProfile {
  return {
    profileId: profile.id,
    attendeeId,
    attendeeRole: attendeeMeta?.role ?? null,
    attendeeClassLevel: attendeeMeta?.classLevel ?? null,
    university: attendeeMeta?.university ?? null,
    fullName: profile.full_name,
    headline: profile.headline,
    interestArea: profile.interest_area,
    dentistryFocusAreas: profile.dentistry_focus_areas,
    goal: profile.goal,
    institutionName: profile.institution_name,
    instagram: attendeeMeta?.instagram ?? null,
    linkedin: attendeeMeta?.linkedin ?? null,
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
