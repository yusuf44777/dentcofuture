import {
  NETWORKING_AVAILABILITY_OPTIONS,
  NETWORKING_COLLABORATION_GOAL_OPTIONS,
  NETWORKING_DENTISTRY_FOCUS_OPTIONS,
  type NetworkingFeedResponse,
  NETWORKING_FUTURE_PATH_OPTIONS,
  NETWORKING_INTEREST_OPTIONS,
  type NetworkingInteractionAction,
  type NetworkingInteractionResponse,
  NETWORKING_LANGUAGE_OPTIONS,
  NETWORKING_MAX_DENTISTRY_FOCUS_COUNT,
  NETWORKING_MAX_GOAL_COUNT,
  NETWORKING_MAX_LANGUAGE_COUNT,
  NETWORKING_MAX_TOPIC_COUNT,
  type NetworkingMatchesResponse,
  NETWORKING_PROFESSION_OPTIONS,
  NETWORKING_TOPIC_OPTIONS,
  type NetworkingDiscoveryResponse,
  type NetworkingProfileResponse,
  type NetworkingPublicProfile
} from "./contracts";
import {
  getInstagramDisplay,
  getInstagramProfileUrl,
  getLinkedinDisplay,
  getLinkedinProfileUrl,
  parseContactInfo
} from "./networking-contact";
import { apiRequest } from "./api";

export type ProfileFormValues = {
  fullName: string;
  headline: string;
  interestArea: string;
  dentistryFocusAreas: string[];
  futurePath: string;
  profession: string;
  city: string;
  institutionName: string;
  yearsExperience: string;
  bio: string;
  topics: string[];
  collaborationGoals: string[];
  languages: string[];
  availability: string;
  instagram: string;
  linkedin: string;
  isVisible: boolean;
};

export function createEmptyProfileForm(): ProfileFormValues {
  return {
    fullName: "",
    headline: "",
    interestArea: NETWORKING_INTEREST_OPTIONS[0],
    dentistryFocusAreas: [],
    futurePath: NETWORKING_FUTURE_PATH_OPTIONS[0],
    profession: NETWORKING_PROFESSION_OPTIONS[0],
    city: "",
    institutionName: "",
    yearsExperience: "",
    bio: "",
    topics: [],
    collaborationGoals: [],
    languages: [NETWORKING_LANGUAGE_OPTIONS[0]],
    availability: "",
    instagram: "",
    linkedin: "",
    isVisible: true
  };
}

export function estimateProfileCompleteness(values: ProfileFormValues) {
  const checks = [
    values.fullName.trim().length > 1,
    values.headline.trim().length > 0,
    values.interestArea.trim().length > 0,
    values.dentistryFocusAreas.length > 0,
    values.city.trim().length > 0,
    values.institutionName.trim().length > 0,
    values.yearsExperience.trim().length > 0,
    values.bio.trim().length > 0,
    values.topics.length > 0,
    values.collaborationGoals.length > 0,
    values.languages.length > 0,
    values.availability.length > 0,
    values.instagram.trim().length > 0 || values.linkedin.trim().length > 0
  ];

  const completedFieldCount = checks.filter(Boolean).length;
  return Math.round((completedFieldCount / checks.length) * 100);
}

export function toggleListValue(currentValues: string[], nextValue: string, limit: number) {
  if (currentValues.includes(nextValue)) {
    return currentValues.filter((value) => value !== nextValue);
  }

  if (currentValues.length >= limit) {
    return currentValues;
  }

  return [...currentValues, nextValue];
}

export function profileToFormValues(profile: NetworkingPublicProfile): ProfileFormValues {
  const contact = parseContactInfo(profile.contact_info);

  return {
    fullName: profile.full_name,
    headline: profile.headline ?? "",
    interestArea: profile.interest_area,
    dentistryFocusAreas: profile.dentistry_focus_areas ?? [],
    futurePath: profile.goal,
    profession: profile.profession ?? NETWORKING_PROFESSION_OPTIONS[0],
    city: profile.city ?? "",
    institutionName: profile.institution_name ?? "",
    yearsExperience:
      typeof profile.years_experience === "number" ? String(profile.years_experience) : "",
    bio: profile.bio ?? "",
    topics: profile.topics,
    collaborationGoals: profile.collaboration_goals,
    languages: profile.languages.length > 0 ? profile.languages : [NETWORKING_LANGUAGE_OPTIONS[0]],
    availability: profile.availability ?? "",
    instagram: contact.instagram,
    linkedin: contact.linkedin,
    isVisible: profile.is_visible
  };
}

export function getProfileContact(profile: NetworkingPublicProfile) {
  const contact = parseContactInfo(profile.contact_info);
  const instagramUrl = getInstagramProfileUrl(contact.instagram);
  const linkedinUrl = getLinkedinProfileUrl(contact.linkedin);

  return {
    instagram: {
      value: contact.instagram,
      label: getInstagramDisplay(contact.instagram),
      url: instagramUrl
    },
    linkedin: {
      value: contact.linkedin,
      label: getLinkedinDisplay(contact.linkedin),
      url: linkedinUrl
    }
  };
}

function buildProfilePayload(values: ProfileFormValues) {
  return {
    fullName: values.fullName,
    headline: values.headline,
    interestArea: values.interestArea,
    dentistryFocusAreas: values.dentistryFocusAreas,
    futurePath: values.futurePath,
    profession: values.profession,
    city: values.city,
    institutionName: values.institutionName,
    yearsExperience: values.yearsExperience.trim() ? Number(values.yearsExperience.trim()) : null,
    bio: values.bio,
    topics: values.topics,
    collaborationGoals: values.collaborationGoals,
    languages: values.languages,
    availability: values.availability,
    instagram: values.instagram,
    linkedin: values.linkedin,
    isVisible: values.isVisible
  };
}

export async function fetchNetworkingProfile(profileId: string) {
  return apiRequest<NetworkingProfileResponse>(`/api/networking/profile?id=${profileId}`);
}

export async function createNetworkingProfile(values: ProfileFormValues) {
  return apiRequest<NetworkingProfileResponse>("/api/networking/profile", {
    method: "POST",
    body: JSON.stringify(buildProfilePayload(values))
  });
}

export async function updateNetworkingProfile(profileId: string, values: ProfileFormValues) {
  return apiRequest<NetworkingProfileResponse>("/api/networking/profile", {
    method: "PUT",
    body: JSON.stringify({
      profileId,
      ...buildProfilePayload(values)
    })
  });
}

export async function fetchNetworkingDiscovery(profileId: string) {
  return apiRequest<NetworkingDiscoveryResponse>(`/api/networking/discovery?profileId=${profileId}`);
}

export async function fetchNetworkingFeed(profileId: string) {
  return apiRequest<NetworkingFeedResponse>(`/api/networking/feed?profileId=${profileId}`);
}

export async function sendNetworkingInteraction(
  actorProfileId: string,
  targetProfileId: string,
  action: NetworkingInteractionAction
) {
  return apiRequest<NetworkingInteractionResponse>("/api/networking/interactions", {
    method: "POST",
    body: JSON.stringify({
      actorProfileId,
      targetProfileId,
      action
    })
  });
}

export async function fetchNetworkingMatches(profileId: string) {
  return apiRequest<NetworkingMatchesResponse>(`/api/networking/matches?profileId=${profileId}`);
}

export const networkingFilterOptions = {
  interestAreas: NETWORKING_INTEREST_OPTIONS,
  dentistryFocusAreas: NETWORKING_DENTISTRY_FOCUS_OPTIONS,
  futurePaths: NETWORKING_FUTURE_PATH_OPTIONS,
  professions: NETWORKING_PROFESSION_OPTIONS,
  topics: NETWORKING_TOPIC_OPTIONS,
  collaborationGoals: NETWORKING_COLLABORATION_GOAL_OPTIONS,
  languages: NETWORKING_LANGUAGE_OPTIONS,
  availability: NETWORKING_AVAILABILITY_OPTIONS
};

export const networkingSelectionLimits = {
  dentistryFocusAreas: NETWORKING_MAX_DENTISTRY_FOCUS_COUNT,
  topics: NETWORKING_MAX_TOPIC_COUNT,
  collaborationGoals: NETWORKING_MAX_GOAL_COUNT,
  languages: NETWORKING_MAX_LANGUAGE_COUNT
};
