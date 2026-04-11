import type { ImagePickerAsset } from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { apiRequest } from "./api";
import type {
  AttendeeClassLevel,
  MobileLiveState,
  MobileMatchThread,
  MobileMe,
  MobileNetworkingFeed,
  MobileNetworkingGalleryCommentsResponse,
  MobileNetworkingGalleryComment,
  MobileNetworkingGalleryFeed,
  MobileNetworkingGalleryUploaderResponse,
  MobileOtpSession,
  StaffCapability,
  StaffOverview
} from "./mobile-contracts";

type OnboardingPayload = {
  name: string;
  role: "Student" | "Academic";
  class_level?: AttendeeClassLevel | null;
  instagram?: string;
  linkedin?: string;
  outlier_score?: number;
};

type GalleryUploadSessionResponse = {
  ok: true;
  upload: {
    path: string;
    token: string;
    signedUrl: string;
  };
  normalized: {
    mediaType: "photo" | "video";
    mimeType: string;
    fileSize: number;
    uploaderName: string;
    caption: string;
  };
};

type GalleryFinalizeResponse = {
  ok: true;
  item: {
    id: string;
    uploader_name: string;
    caption: string | null;
    media_type: "photo" | "video";
    mime_type: string;
    file_path: string;
    public_url: string;
    file_size: number;
    created_at: string;
  };
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
  return apiRequest<{ ok: true; emojiCount?: number; myReactionCount?: number }>(
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

export function fetchNetworkingGalleryFeed(limit = 18) {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(6, Math.min(36, Math.floor(limit)))
    : 18;
  return apiRequest<MobileNetworkingGalleryFeed>(
    `/api/mobile/networking/gallery/feed?limit=${normalizedLimit}`,
    undefined,
    { auth: true }
  );
}

export function toggleNetworkingGalleryLike(itemId: string) {
  return apiRequest<{
    ok: true;
    itemId: string;
    liked: boolean;
    likesCount: number;
  }>(
    "/api/mobile/networking/gallery/likes",
    {
      method: "POST",
      body: JSON.stringify({ itemId })
    },
    { auth: true }
  );
}

export function createNetworkingGalleryComment(itemId: string, text: string) {
  return apiRequest<{
    ok: true;
    itemId: string;
    commentsCount: number;
    comment: MobileNetworkingGalleryComment;
  }>(
    "/api/mobile/networking/gallery/comments",
    {
      method: "POST",
      body: JSON.stringify({ itemId, text })
    },
    { auth: true }
  );
}

export function fetchNetworkingGalleryComments(itemId: string, limit = 40) {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(10, Math.min(120, Math.floor(limit)))
    : 40;

  return apiRequest<MobileNetworkingGalleryCommentsResponse>(
    `/api/mobile/networking/gallery/comments?itemId=${encodeURIComponent(itemId)}&limit=${normalizedLimit}`,
    undefined,
    { auth: true }
  );
}

export async function fetchNetworkingGalleryUploaderProfile(name: string, limit = 24) {
  const normalizedName = name.replace(/\s+/g, " ").trim();
  if (normalizedName.length < 2) {
    throw new Error("Geçerli bir kullanıcı adı gerekli.");
  }

  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(6, Math.min(60, Math.floor(limit)))
    : 24;

  try {
    return await apiRequest<MobileNetworkingGalleryUploaderResponse>(
      `/api/mobile/networking/gallery/uploader?name=${encodeURIComponent(normalizedName)}&limit=${normalizedLimit}`,
      undefined,
      { auth: true }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const isMissingEndpointError = message.includes("http 404") || message.includes("endpoint");
    if (!isMissingEndpointError) {
      throw error;
    }

    const feed = await fetchNetworkingGalleryFeed(Math.max(18, normalizedLimit));
    const posts = (feed.posts ?? [])
      .filter(
        (post) =>
          post.uploaderName.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR") ===
          normalizedName.toLocaleLowerCase("tr-TR")
      )
      .slice(0, normalizedLimit)
      .map((post) => ({
        id: post.id,
        caption: post.caption,
        mediaType: post.mediaType,
        publicUrl: post.publicUrl,
        createdAt: post.createdAt,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount
      }));

    if (posts.length === 0) {
      throw new Error("Profil detayları şu an yüklenemedi.");
    }

    return {
      ok: true,
      uploader: {
        attendeeId: null,
        name: normalizedName,
        role: null,
        classLevel: null,
        instagram: null,
        linkedin: null
      },
      posts,
      refreshedAt: new Date().toISOString()
    };
  }
}

function inferFileNameFromAsset(asset: ImagePickerAsset) {
  if (asset.fileName && asset.fileName.trim().length > 0) {
    return asset.fileName.trim();
  }

  const fromUri = asset.uri.split("/").pop()?.trim() ?? "";
  if (fromUri.length > 0) {
    return fromUri;
  }

  return `outliers-${Date.now()}.jpg`;
}

function inferImageMimeType(fileName: string, fallback?: string | null) {
  if (fallback && fallback.startsWith("image/")) {
    return fallback;
  }

  const lowered = fileName.toLowerCase();
  if (lowered.endsWith(".png")) return "image/png";
  if (lowered.endsWith(".webp")) return "image/webp";
  if (lowered.endsWith(".heic")) return "image/heic";
  if (lowered.endsWith(".heif")) return "image/heif";
  if (lowered.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function createNetworkingGalleryPost(input: {
  asset: ImagePickerAsset;
  caption?: string;
  uploaderName: string;
}) {
  const fileName = inferFileNameFromAsset(input.asset);
  const mimeType = inferImageMimeType(fileName, input.asset.mimeType ?? null);
  let fileSize = Number(input.asset.fileSize ?? 0);

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    const fileInfo = await FileSystem.getInfoAsync(input.asset.uri);
    if (!fileInfo.exists || typeof fileInfo.size !== "number") {
      throw new Error("Seçilen fotoğraf dosyası okunamadı.");
    }
    fileSize = Number(fileInfo.size);
  }

  if (!mimeType.startsWith("image/")) {
    throw new Error("Bu sürümde sadece fotoğraf yükleyebilirsin.");
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("Geçerli bir fotoğraf seçmelisin.");
  }

  const session = await apiRequest<GalleryUploadSessionResponse>(
    "/api/gallery/upload-session",
    {
      method: "POST",
      body: JSON.stringify({
        fileName,
        mimeType,
        fileSize,
        uploaderName: input.uploaderName,
        caption: input.caption ?? ""
      })
    },
    { auth: true }
  );

  if (session.normalized.mediaType !== "photo") {
    throw new Error("Bu sürümde sadece fotoğraf yükleme açık.");
  }

  const uploadResult = await FileSystem.uploadAsync(session.upload.signedUrl, input.asset.uri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "content-type": session.normalized.mimeType
    }
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    const detail = uploadResult.body?.trim().slice(0, 220);
    throw new Error(`Fotoğraf yüklenemedi: ${detail || `HTTP ${uploadResult.status}`}`);
  }

  return apiRequest<GalleryFinalizeResponse>(
    "/api/gallery/finalize",
    {
      method: "POST",
      body: JSON.stringify({
        path: session.upload.path,
        mimeType: session.normalized.mimeType,
        fileSize: session.normalized.fileSize,
        uploaderName: session.normalized.uploaderName,
        caption: session.normalized.caption
      })
    },
    { auth: true }
  );
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
