export type ResponseMode = "text" | "poll";

export const LIVE_POLL_PROMPT = "Mezun olduktan sonra hangi alanı düşünüyorsunuz?";

export const LIVE_POLL_OPTIONS = [
  "DUS",
  "Doktora",
  "Kamu",
  "Klinik"
] as const;
export type LivePollOption = (typeof LIVE_POLL_OPTIONS)[number];

export const POLL_MESSAGE_PREFIX = "ANKET:";

export type LivePollConfig = {
  id: string;
  question: string;
  options: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ParsedPollResponse = {
  pollId: string | null;
  option: string;
};

function normalizePollText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function createPollMessage(option: string, pollId?: string | null) {
  const normalizedOption = normalizePollText(option).slice(0, 120);
  const normalizedPollId = typeof pollId === "string" ? pollId.trim() : "";

  if (!normalizedOption) {
    return POLL_MESSAGE_PREFIX;
  }

  if (!normalizedPollId) {
    return `${POLL_MESSAGE_PREFIX} ${normalizedOption}`.slice(0, 200);
  }

  const payload = JSON.stringify({
    pollId: normalizedPollId,
    option: normalizedOption
  });

  return `${POLL_MESSAGE_PREFIX}${payload}`.slice(0, 200);
}

export function isPollMessage(message: string) {
  return message.trimStart().startsWith(POLL_MESSAGE_PREFIX);
}

export function parsePollResponse(message: string): ParsedPollResponse | null {
  if (!isPollMessage(message)) {
    return null;
  }

  const payload = message.trimStart().slice(POLL_MESSAGE_PREFIX.length).trim();
  if (!payload) {
    return null;
  }

  if (payload.startsWith("{")) {
    try {
      const parsed = JSON.parse(payload) as {
        pollId?: unknown;
        option?: unknown;
      };

      const option =
        typeof parsed.option === "string" ? normalizePollText(parsed.option).slice(0, 120) : "";
      if (!option) {
        return null;
      }

      const pollId = typeof parsed.pollId === "string" ? parsed.pollId.trim() : "";
      return {
        pollId: pollId || null,
        option
      };
    } catch {
      return null;
    }
  }

  const legacyOption = normalizePollText(payload).slice(0, 120);
  if (!legacyOption) {
    return null;
  }

  return {
    pollId: null,
    option: legacyOption
  };
}

export function parsePollOption(message: string): LivePollOption | null {
  const parsed = parsePollResponse(message);
  if (!parsed) {
    return null;
  }

  return LIVE_POLL_OPTIONS.find((item) => item === parsed.option) ?? null;
}
