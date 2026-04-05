type AllowedParticipant = {
  email: string;
  phone?: string;
};

const DEFAULT_ALLOWED_PARTICIPANTS: AllowedParticipant[] = [
  {
    email: "mahiryusuf531@gmail.com"
  }
];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";

  if (digits.startsWith("00")) {
    return digits.slice(2);
  }

  if (digits.length === 10) {
    return `90${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `90${digits.slice(1)}`;
  }

  return digits;
}

function parseAllowedParticipantsFromEnv(): AllowedParticipant[] {
  const raw = (process.env.MOBILE_ALLOWED_PARTICIPANTS ?? "").trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [emailRaw, phoneRaw] = entry.split("|");
      const email = normalizeEmail(emailRaw ?? "");
      const phone = normalizePhone(phoneRaw ?? "");

      if (!email) {
        return null;
      }

      return {
        email,
        ...(phone ? { phone } : {})
      } satisfies AllowedParticipant;
    })
    .filter((item): item is AllowedParticipant => item !== null);
}

function getAllowedParticipants() {
  const fromEnv = parseAllowedParticipantsFromEnv();
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_PARTICIPANTS;
}

export function isParticipantAllowed(emailInput: string, phoneInput: string) {
  const email = normalizeEmail(emailInput);
  const phone = normalizePhone(phoneInput);
  if (!email || !phone) {
    return false;
  }

  const participants = getAllowedParticipants();
  return participants.some((participant) => {
    if (normalizeEmail(participant.email) !== email) {
      return false;
    }

    if (!participant.phone) {
      // Geriye donuk olarak sadece e-posta kayitli katilimcilara izin verir.
      // Tam cift-guvenlik icin MOBILE_ALLOWED_PARTICIPANTS icinde telefonu da girin.
      return true;
    }

    return normalizePhone(participant.phone) === phone;
  });
}

export { normalizeEmail, normalizePhone };
