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

export const NETWORKING_FUTURE_PATH_OPTIONS = [
  "DUS",
  "Kamu",
  "Klinik",
  "Akademi",
  "Girişim"
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
  "Dijital iş akışı",
  "Şeffaf plak planlaması",
  "İmplant rehabilitasyonu",
  "Gülüş tasarımı",
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
  "Etkinlik sonrası çevrim içi görüşebilirim"
] as const;

export const NETWORKING_MAX_TOPIC_COUNT = 6;
export const NETWORKING_MAX_GOAL_COUNT = 4;
export const NETWORKING_MAX_LANGUAGE_COUNT = 4;

export type NetworkingPublicProfile = {
  id: string;
  full_name: string;
  headline: string | null;
  interest_area: string;
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
