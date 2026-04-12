export type AttendeeRole = "Student" | "Clinician" | "Academic" | "Entrepreneur" | "Industry";
export type ParticipantProfileRole = "Student" | "Academic";
export type AttendeeClassLevel = "Hazırlık" | "1" | "2" | "3" | "4" | "5" | "Mezun";

export type Attendee = {
  id: string;
  auth_user_id: string | null;
  name: string;
  role: AttendeeRole;
  class_level: AttendeeClassLevel | null;
  instagram: string | null;
  linkedin: string | null;
  avatar_url: string | null;
  outlier_score: number;
  points: number;
  created_at: string;
};

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

export type MobileNetworkingProfile = {
  profileId: string;
  attendeeId: string | null;
  fullName: string;
  headline: string | null;
  interestArea: string;
  dentistryFocusAreas: string[];
  goal: string;
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

export type MobileNetworkingGalleryPost = {
  id: string;
  uploaderName: string;
  caption: string | null;
  mediaType: "photo" | "video";
  publicUrl: string;
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

export type MobileNetworkingGalleryCommentsResponse = {
  ok: true;
  itemId: string;
  comments: MobileNetworkingGalleryComment[];
  total: number;
};

export type MobileNetworkingGalleryUploader = {
  attendeeId: string | null;
  name: string;
  role: string | null;
  classLevel: AttendeeClassLevel | null;
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

export type MobileNetworkingGalleryUploaderResponse = {
  ok: true;
  uploader: MobileNetworkingGalleryUploader;
  posts: MobileNetworkingGalleryUploaderPost[];
  refreshedAt: string;
};

export type MobileLiveQuestion = {
  id: string;
  text: string;
  votes: number;
  answered: boolean;
  pinned: boolean;
  created_at: string;
  attendee_id: string;
  attendee_name: string | null;
  attendee_role: string | null;
};

export type MobileLiveState = {
  ok: true;
  questions: MobileLiveQuestion[];
  activePoll: {
    id: string;
    question: string;
    options: string[];
    results: Record<string, number>;
    active: boolean;
    session_id: string | null;
    created_at: string;
  } | null;
  pollTotals: Record<string, number>;
  myPollVoteOptionIndex: number | null;
  reactionCounts: Record<string, number>;
  leaderboard: Array<Pick<Attendee, "id" | "name" | "role" | "points">>;
};

export type MobileThreadMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
};

export type MobileMatchThread = {
  otherAttendee: Pick<Attendee, "id" | "name" | "role" | "instagram" | "linkedin">;
  messages: MobileThreadMessage[];
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
    sentiment_score: unknown;
    top_keywords: unknown;
  } | null;
};

export type MobileOtpSession = {
  ok: true;
  user: {
    id: string;
    email?: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
};
