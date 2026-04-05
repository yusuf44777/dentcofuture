import { apiRequest } from "./api";
import type {
  MobileLiveState,
  MobileMatchThread,
  MobileMe,
  MobileNetworkingFeed,
  MobileOtpSession,
  StaffCapability,
  StaffOverview
} from "./mobile-contracts";

type OnboardingPayload = {
  name: string;
  role: "Student" | "Clinician" | "Academic" | "Entrepreneur" | "Industry";
  instagram?: string;
  linkedin?: string;
  outlier_score?: number;
};

type StepUpCreateResponse = {
  ok: true;
  token: string;
  capabilities?: StaffCapability[];
  expiresInSeconds?: number;
};

async function createStepUpToken(capability: StaffCapability) {
  const response = await apiRequest<StepUpCreateResponse>(
    "/api/mobile/staff/step-up/create",
    {
      method: "POST",
      body: JSON.stringify({
        capabilities: [capability],
        ttlSeconds: 5 * 60
      })
    },
    { auth: true }
  );

  return response.token;
}

export function requestStaffStepUp(capability: StaffCapability) {
  return apiRequest<StepUpCreateResponse>(
    "/api/mobile/staff/step-up/create",
    {
      method: "POST",
      body: JSON.stringify({
        capabilities: [capability],
        ttlSeconds: 5 * 60
      })
    },
    { auth: true }
  );
}

export function verifyStaffStepUp(token: string, capability?: StaffCapability) {
  return apiRequest<{ ok: true; valid: boolean; capability: StaffCapability | null }>(
    "/api/mobile/staff/step-up/verify",
    {
      method: "POST",
      body: JSON.stringify({
        token,
        capability
      })
    },
    { auth: true }
  );
}

async function staffWriteRequest<T>(capability: StaffCapability, path: string, init: RequestInit) {
  const token = await createStepUpToken(capability);
  const nextHeaders = {
    ...(init.headers ?? {}),
    "x-staff-stepup-token": token
  };

  return apiRequest<T>(
    path,
    {
      ...init,
      headers: nextHeaders
    },
    {
      auth: true
    }
  );
}

export function requestOtp(email: string, phone: string) {
  return apiRequest<MobileOtpSession>(
    "/api/mobile/auth/request-otp",
    {
      method: "POST",
      body: JSON.stringify({ email, phone })
    },
    { auth: false, allowRefresh: false }
  );
}

export function fetchMobileMe() {
  return apiRequest<MobileMe>("/api/mobile/me", undefined, { auth: true });
}

export function submitOnboarding(payload: OnboardingPayload) {
  return apiRequest<{ ok: true; attendee: MobileMe["attendee"]; networkingProfileId?: string | null }>(
    "/api/mobile/onboarding",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    { auth: true }
  );
}

export function fetchLiveState() {
  return apiRequest<MobileLiveState>("/api/mobile/live/state", undefined, { auth: true });
}

export function submitLiveQuestion(text: string) {
  return apiRequest<{ ok: true; question: unknown }>(
    "/api/mobile/live/questions",
    {
      method: "POST",
      body: JSON.stringify({ text })
    },
    { auth: true }
  );
}

export function voteLivePoll(pollId: string, optionIndex: number) {
  return apiRequest<{ ok: true; alreadyVoted?: boolean; results?: Record<string, number> }>(
    "/api/mobile/live/polls/vote",
    {
      method: "POST",
      body: JSON.stringify({ pollId, optionIndex })
    },
    { auth: true }
  );
}

export function sendLiveReaction(emoji: "🔥" | "💡" | "🤯" | "👏" | "❓") {
  return apiRequest<{ ok: true; emojiCount: number }>(
    "/api/mobile/live/reactions",
    {
      method: "POST",
      body: JSON.stringify({ emoji })
    },
    { auth: true }
  );
}

export function fetchLeaderboard() {
  return apiRequest<{
    ok: true;
    leaderboard: Array<{ id: string; name: string; role: string; points: number }>;
    me: { attendeeId: string; points: number; rank: number } | null;
  }>("/api/mobile/leaderboard", undefined, { auth: true });
}

export function fetchNetworkingFeed() {
  return apiRequest<MobileNetworkingFeed>("/api/mobile/networking/feed", undefined, { auth: true });
}

export function sendNetworkingInteraction(targetProfileId: string, action: "like" | "pass") {
  return apiRequest<{
    ok: true;
    matched: boolean;
    match?: {
      matchedAt: string;
      profile: MobileNetworkingFeed["queue"][number];
    } | null;
  }>(
    "/api/mobile/networking/interactions",
    {
      method: "POST",
      body: JSON.stringify({ targetProfileId, action })
    },
    { auth: true }
  );
}

export function fetchNetworkingMatches() {
  return apiRequest<{
    ok: true;
    total: number;
    refreshedAt: string;
    matches: Array<{
      matchedAt: string;
      profile: MobileNetworkingFeed["queue"][number];
      attendee: {
        id: string;
        name: string;
        role: string;
        instagram: string | null;
        linkedin: string | null;
      } | null;
    }>;
  }>("/api/mobile/networking/matches", undefined, { auth: true });
}

export function fetchMessageThreads() {
  return apiRequest<{
    ok: true;
    threads: Array<{
      attendee: {
        id: string;
        name: string;
        role: string;
        instagram: string | null;
        linkedin: string | null;
      } | null;
      lastMessage: {
        id: string;
        text: string;
        createdAt: string;
        senderId: string;
      } | null;
    }>;
  }>("/api/mobile/networking/messages", undefined, { auth: true });
}

export function fetchMatchThread(attendeeId: string) {
  return apiRequest<{ ok: true; thread: MobileMatchThread }>(
    `/api/mobile/networking/messages?attendeeId=${encodeURIComponent(attendeeId)}`,
    undefined,
    { auth: true }
  );
}

export function sendMatchMessage(receiverAttendeeId: string, text: string) {
  return apiRequest<{
    ok: true;
    message: {
      id: string;
      senderId: string;
      receiverId: string;
      text: string;
      createdAt: string;
    };
  }>(
    "/api/mobile/networking/messages",
    {
      method: "POST",
      body: JSON.stringify({ receiverAttendeeId, text })
    },
    { auth: true }
  );
}

export function fetchGameScores() {
  return apiRequest<{
    ok: true;
    leaderboard: Array<{
      id: string;
      attendee_id: string;
      score: number;
      wave: number;
      created_at: string;
      attendee?: { name?: string } | null;
    }>;
    personalBest: { score: number; wave: number; created_at: string } | null;
  }>("/api/mobile/game/scores", undefined, { auth: true });
}

export function submitGameScore(score: number, wave: number) {
  return apiRequest<{ ok: true; pointsAward: number }>(
    "/api/mobile/game/scores",
    {
      method: "POST",
      body: JSON.stringify({ score, wave })
    },
    { auth: true }
  );
}

export function submitFeedback(message: string) {
  return apiRequest<{ ok: true }>(
    "/api/mobile/feedback",
    {
      method: "POST",
      body: JSON.stringify({ message })
    },
    { auth: true }
  );
}

export function fetchRafflePublic() {
  return apiRequest<{
    ok: true;
    participants_active: number;
    recent_draws: Array<{
      id: string;
      prize_title: string;
      draw_number: number;
      winner_code: string;
      winner_name: string;
      drawn_at: string;
    }>;
  }>("/api/mobile/raffle/public", undefined, { auth: false });
}

export function fetchStaffOverview() {
  return apiRequest<StaffOverview>("/api/mobile/staff/overview", undefined, { auth: true });
}

export function fetchStaffPolls() {
  return apiRequest<{ ok: true; activePoll: unknown; polls: unknown[] }>(
    "/api/mobile/staff/live/polls",
    undefined,
    { auth: true }
  );
}

export function publishStaffPoll(question: string, options: string[]) {
  return staffWriteRequest<{ ok: true; poll: unknown }>("live.polls.write", "/api/mobile/staff/live/polls", {
    method: "POST",
    body: JSON.stringify({ question, options })
  });
}

export function closeStaffPoll(pollId?: string) {
  return staffWriteRequest<{ ok: true }>("live.polls.write", "/api/mobile/staff/live/polls", {
    method: "DELETE",
    body: JSON.stringify({ pollId })
  });
}

export function fetchStaffQuestions() {
  return apiRequest<{ ok: true; questions: unknown[] }>("/api/mobile/staff/live/questions", undefined, {
    auth: true
  });
}

export function updateStaffQuestion(questionId: string, updates: { pinned?: boolean; answered?: boolean }) {
  return staffWriteRequest<{ ok: true; question: unknown }>(
    "live.questions.write",
    "/api/mobile/staff/live/questions",
    {
      method: "PATCH",
      body: JSON.stringify({ questionId, ...updates })
    }
  );
}

export function fetchStaffRaffleOverview() {
  return apiRequest<{
    ok: true;
    stats: {
      participants_total: number;
      participants_active: number;
      active_prizes: number;
      total_draws: number;
    };
    prizes: unknown[];
    recent_draws: unknown[];
  }>("/api/mobile/staff/raffle/overview", undefined, { auth: true });
}

export function drawStaffRaffle(prizeId: string) {
  return staffWriteRequest<{ ok: true; winner: unknown }>("raffle.write", "/api/mobile/staff/raffle/draw", {
    method: "POST",
    body: JSON.stringify({ prizeId })
  });
}

export function fetchStaffPrizes() {
  return apiRequest<{ ok: true; prizes: unknown[] }>("/api/mobile/staff/raffle/prizes", undefined, {
    auth: true
  });
}

export function createStaffPrize(payload: {
  title: string;
  description?: string;
  quantity: number;
  allowPreviousWinner?: boolean;
  isActive?: boolean;
}) {
  return staffWriteRequest<{ ok: true; prize: unknown }>("raffle.write", "/api/mobile/staff/raffle/prizes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateStaffPrize(payload: {
  prizeId: string;
  title?: string;
  description?: string;
  quantity?: number;
  allowPreviousWinner?: boolean;
  isActive?: boolean;
}) {
  return staffWriteRequest<{ ok: true; prize: unknown }>("raffle.write", "/api/mobile/staff/raffle/prizes", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function fetchStaffParticipants(params?: { q?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.q) {
    search.set("q", params.q);
  }
  if (typeof params?.limit === "number") {
    search.set("limit", String(params.limit));
  }

  const suffix = search.toString();
  return apiRequest<{ ok: true; participants: unknown[] }>(
    `/api/mobile/staff/participants${suffix ? `?${suffix}` : ""}`,
    undefined,
    { auth: true }
  );
}

export function createStaffParticipant(payload: {
  fullName: string;
  participantCode?: string;
  externalRef?: string;
  isActive?: boolean;
}) {
  return staffWriteRequest<{ ok: true; participant: unknown }>(
    "participants.write",
    "/api/mobile/staff/participants",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export function updateStaffParticipant(payload: {
  participantId: string;
  fullName?: string;
  participantCode?: string;
  externalRef?: string;
  isActive?: boolean;
}) {
  return staffWriteRequest<{ ok: true; participant: unknown }>(
    "participants.write",
    "/api/mobile/staff/participants",
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    }
  );
}
