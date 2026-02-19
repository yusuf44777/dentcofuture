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

export function createPollMessage(option: LivePollOption) {
  return `${POLL_MESSAGE_PREFIX} ${option}`.slice(0, 200);
}

export function isPollMessage(message: string) {
  return message.trimStart().startsWith(POLL_MESSAGE_PREFIX);
}

export function parsePollOption(message: string): LivePollOption | null {
  if (!isPollMessage(message)) {
    return null;
  }

  const option = message.replace(POLL_MESSAGE_PREFIX, "").trim();
  return LIVE_POLL_OPTIONS.find((item) => item === option) ?? null;
}
