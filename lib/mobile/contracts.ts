import type { Attendee, Json, Poll, Question, ReactionEmoji } from "@/lib/types";

export type MobileRole = "participant" | "staff";

export type StaffCapability =
  | "staff.read"
  | "live.polls.write"
  | "live.questions.write"
  | "raffle.write"
  | "participants.write";

export type MobileStaffRole = {
  role: string;
  capabilities: StaffCapability[];
  isActive: boolean;
};

export type MobileMe = {
  ok: true;
  authUserId: string;
  role: MobileRole;
  attendee: Attendee | null;
  staffRole: MobileStaffRole | null;
};

export type MobileQuestionItem = Pick<
  Question,
  "id" | "text" | "votes" | "answered" | "pinned" | "created_at" | "attendee_id"
> & {
  attendee_name: string | null;
  attendee_role: string | null;
};

export type MobileLiveState = {
  ok: true;
  questions: MobileQuestionItem[];
  activePoll: Poll | null;
  pollTotals: Record<string, number>;
  myPollVoteOptionIndex: number | null;
  reactionCounts: Record<ReactionEmoji, number>;
  leaderboard: Pick<Attendee, "id" | "name" | "role" | "points">[];
};

export type MobileNetworkingProfile = {
  profileId: string;
  attendeeId: string | null;
  attendeeRole: string | null;
  attendeeClassLevel: string | null;
  university: string | null;
  fullName: string;
  headline: string | null;
  interestArea: string;
  dentistryFocusAreas: string[];
  goal: string;
  institutionName: string | null;
  instagram: string | null;
  linkedin: string | null;
  city: string | null;
  bio: string | null;
  topics: string[];
  collaborationGoals: string[];
  languages: string[];
  contactInfo: string | null;
  matchScore?: number;
  matchReasons?: string[];
};

export type MobileNetworkingFeed = {
  ok: true;
  current: MobileNetworkingProfile | null;
  recommended: MobileNetworkingProfile[];
  directory: MobileNetworkingProfile[];
  queue: MobileNetworkingProfile[];
  likesSentCount: number;
  mutualMatchesCount: number;
  message: string;
  refreshedAt: string;
};

export type MobileNetworkingGalleryComment = {
  id: string;
  itemId: string;
  attendeeId: string;
  attendeeName: string;
  attendeeRole: string | null;
  text: string;
  createdAt: string;
};

export type MobileNetworkingGalleryMediaItem = {
  id: string;
  mediaType: "photo" | "video";
  publicUrl: string;
};

export type MobileNetworkingGalleryPost = {
  id: string;
  uploaderName: string;
  caption: string | null;
  mediaType: "photo" | "video";
  publicUrl: string;
  mediaItems: MobileNetworkingGalleryMediaItem[];
  mediaCount: number;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  recentComments: MobileNetworkingGalleryComment[];
};

export type MobileNetworkingGalleryFeed = {
  ok: true;
  posts: MobileNetworkingGalleryPost[];
  refreshedAt: string;
};

export type MobileNetworkingGalleryComments = {
  ok: true;
  itemId: string;
  comments: MobileNetworkingGalleryComment[];
  total: number;
};

export type MobileNetworkingGalleryUploader = {
  attendeeId: string | null;
  name: string;
  role: string | null;
  classLevel: Attendee["class_level"] | null;
  instagram: string | null;
  linkedin: string | null;
};

export type MobileNetworkingGalleryUploaderPost = {
  id: string;
  caption: string | null;
  mediaType: "photo" | "video";
  publicUrl: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
};

export type MobileNetworkingGalleryUploaderProfile = {
  ok: true;
  uploader: MobileNetworkingGalleryUploader;
  posts: MobileNetworkingGalleryUploaderPost[];
  refreshedAt: string;
};

export type MobileMatchThread = {
  otherAttendee: Pick<Attendee, "id" | "name" | "role" | "instagram" | "linkedin">;
  messages: Array<{
    id: string;
    senderId: string;
    receiverId: string;
    text: string;
    createdAt: string;
  }>;
};

export type StaffOverview = {
  ok: true;
  stats: {
    attendees: number;
    questions: number;
    activePolls: number;
    reactions: number;
    raffleParticipants: number;
    rafflePrizes: number;
    raffleDraws: number;
    feedbacks: number;
  };
  latestAnalytics: {
    created_at: string;
    total_feedbacks: number;
    sentiment_score: Json;
    top_keywords: Json;
  } | null;
};

export type StaffActionResult = {
  ok: boolean;
  message: string;
  operationId?: string;
};
