export const NETWORKING_INTEREST_OPTIONS = [
  "Ortodonti",
  "Periodontoloji",
  "Endodonti",
  "Pedodonti (Çocuk Diş Hekimliği)",
  "Ağız, Diş ve Çene Cerrahisi",
  "Protetik Diş Tedavisi",
  "Restoratif Diş Tedavisi",
  "Oral Diagnoz ve Radyoloji",
  "Implantoloji",
  "Estetik Diş Hekimliği",
  "Dijital Diş Hekimliği"
] as const;

export const NETWORKING_DENTISTRY_FOCUS_OPTIONS = NETWORKING_INTEREST_OPTIONS;

export const NETWORKING_FUTURE_PATH_OPTIONS = [
  "DUS",
  "Kamu",
  "Klinik",
  "Akademi",
  "Girisim"
] as const;

export const NETWORKING_PROFESSION_OPTIONS = [
  "Diş Hekimi",
  "Uzman Diş Hekimi",
  "Araştırma Görevlisi",
  "Akademisyen",
  "Klinik Kurucusu",
  "Öğrenci"
] as const;

export const NETWORKING_TOPIC_OPTIONS = [
  "Digital workflow",
  "Aligner planlama",
  "Implant rehabilitasyonu",
  "Gulus tasarimi",
  "Mikroskopik endodonti",
  "Pediyatrik hasta yönetimi",
  "Cerrahi vaka paylaşımı",
  "Radyoloji ve görüntüleme",
  "Dental fotoğrafçılık",
  "Klinik pazarlama",
  "Ekip yönetimi",
  "Sağlık teknolojileri",
  "Araştırma işbirliği",
  "Eğitim ve mentorluk"
] as const;

export const NETWORKING_COLLABORATION_GOAL_OPTIONS = [
  "Vaka tartışması",
  "Mentorluk",
  "Yatırım ve ortaklık",
  "Klinik sevk ağı",
  "Akademik araştırma",
  "Eğitim organizasyonu",
  "Ar-Ge ve teknoloji",
  "Satın alma ve tedarik"
] as const;

export const NETWORKING_LANGUAGE_OPTIONS = [
  "Türkçe",
  "İngilizce",
  "Almanca",
  "Arapça",
  "Fransızca",
  "Rusça"
] as const;

export const NETWORKING_AVAILABILITY_OPTIONS = [
  "Etkinlik boyunca görüşebilirim",
  "Sadece kahve molalarında",
  "Akşam networking buluşmalarına açığım",
  "Etkinlik sonrası online görüşebilirim"
] as const;

export const NETWORKING_MAX_TOPIC_COUNT = 6;
export const NETWORKING_MAX_GOAL_COUNT = 4;
export const NETWORKING_MAX_LANGUAGE_COUNT = 4;
export const NETWORKING_MAX_DENTISTRY_FOCUS_COUNT = 4;

export type NetworkingInterestOption = (typeof NETWORKING_INTEREST_OPTIONS)[number];
export type NetworkingFuturePathOption = (typeof NETWORKING_FUTURE_PATH_OPTIONS)[number];
export type NetworkingProfessionOption = (typeof NETWORKING_PROFESSION_OPTIONS)[number];
export type NetworkingTopicOption = (typeof NETWORKING_TOPIC_OPTIONS)[number];
export type NetworkingCollaborationGoalOption =
  (typeof NETWORKING_COLLABORATION_GOAL_OPTIONS)[number];
export type NetworkingLanguageOption = (typeof NETWORKING_LANGUAGE_OPTIONS)[number];
export type NetworkingAvailabilityOption = (typeof NETWORKING_AVAILABILITY_OPTIONS)[number];

export type NetworkingContactLinks = {
  instagram: string;
  linkedin: string;
};

export type NetworkingProfileInput = {
  fullName: string;
  headline: string;
  interestArea: string;
  dentistryFocusAreas: string[];
  futurePath: string;
  profession: string;
  city: string;
  institutionName: string;
  yearsExperience: number | null;
  bio: string;
  topics: string[];
  collaborationGoals: string[];
  languages: string[];
  availability: string;
  instagram: string;
  linkedin: string;
  isVisible: boolean;
};

export type NetworkingPublicProfile = {
  id: string;
  attendee_id?: string | null;
  full_name: string;
  headline: string | null;
  interest_area: string;
  dentistry_focus_areas: string[];
  goal: string;
  profession: string | null;
  city: string | null;
  institution_name: string | null;
  years_experience: number | null;
  bio: string | null;
  topics: string[];
  collaboration_goals: string[];
  languages: string[];
  availability: string | null;
  contact_info: string | null;
  is_visible: boolean;
  profile_completion_score: number;
  last_active_at: string;
  created_at: string;
  match_score?: number;
  match_reasons?: string[];
};

export type NetworkingProfileResponse = {
  ok: boolean;
  id: string;
  profile: NetworkingPublicProfile;
};

export type NetworkingInteractionAction = "like" | "pass";

export type NetworkingMatchRecord = {
  profile: NetworkingPublicProfile;
  matchedAt: string;
};

export type NetworkingDiscoveryResponse = {
  status: "found" | "waiting";
  currentProfile: NetworkingPublicProfile | null;
  recommendedProfiles: NetworkingPublicProfile[];
  similarProfiles: NetworkingPublicProfile[];
  otherProfiles: NetworkingPublicProfile[];
  message: string;
  refreshedAt: string;
};

export type NetworkingFeedResponse = {
  status: "ready" | "empty";
  currentProfile: NetworkingPublicProfile | null;
  recommended: NetworkingPublicProfile[];
  directory: NetworkingPublicProfile[];
  queue: NetworkingPublicProfile[];
  likesSentCount: number;
  mutualMatchesCount: number;
  message: string;
  refreshedAt: string;
};

export type NetworkingInteractionResponse = {
  ok: boolean;
  action: NetworkingInteractionAction;
  actorProfileId: string;
  targetProfileId: string;
  matched: boolean;
  match?: NetworkingMatchRecord;
};

export type NetworkingMatchesResponse = {
  ok: boolean;
  currentProfile: NetworkingPublicProfile | null;
  matches: NetworkingMatchRecord[];
  total: number;
  refreshedAt: string;
};
