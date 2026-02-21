export type ParsedNetworkingContact = {
  instagram: string;
  linkedin: string;
};

export function normalizeInstagramHandle(input: string) {
  let value = input.trim();
  if (!value) {
    return "";
  }

  value = value.replace(/^https?:\/\/(www\.)?/i, "");
  value = value.replace(/^www\./i, "");
  value = value.replace(/^instagram\.com\//i, "");
  value = value.replace(/^@+/, "");
  value = value.split(/[/?#]/)[0] ?? "";
  value = value.replace(/[^a-zA-Z0-9._]/g, "");

  return value.slice(0, 40);
}

export function normalizeLinkedinPath(input: string) {
  let value = input.trim();
  if (!value) {
    return "";
  }

  value = value.replace(/^https?:\/\/(www\.)?/i, "");
  value = value.replace(/^www\./i, "");
  value = value.replace(/^linkedin\.com\//i, "");
  value = value.split(/[?#]/)[0] ?? "";
  value = value.replace(/^\/+|\/+$/g, "");
  value = value.replace(/\/{2,}/g, "/");

  if (!value) {
    return "";
  }

  if (!/^(in|company)\//i.test(value)) {
    value = `in/${value}`;
  }

  const [kindRaw, ...restParts] = value.split("/").filter(Boolean);
  const kind = (kindRaw ?? "").toLowerCase();
  if ((kind !== "in" && kind !== "company") || restParts.length === 0) {
    return "";
  }

  const rest = restParts.join("/").replace(/[^a-zA-Z0-9._%/-]/g, "");
  if (!rest) {
    return "";
  }

  return `${kind}/${rest}`.slice(0, 60);
}

export function buildContactInfo(instagramInput: string, linkedinInput: string) {
  const instagram = normalizeInstagramHandle(instagramInput);
  const linkedin = normalizeLinkedinPath(linkedinInput);
  const parts: string[] = [];

  if (instagram) {
    parts.push(`ig:${instagram}`);
  }
  if (linkedin) {
    parts.push(`in:${linkedin}`);
  }

  const joined = parts.join("|");
  return joined.length > 0 ? joined : null;
}

export function parseContactInfo(raw: string | null): ParsedNetworkingContact {
  if (!raw) {
    return { instagram: "", linkedin: "" };
  }

  const parts = raw.split("|");
  let instagram = "";
  let linkedin = "";

  for (const part of parts) {
    if (part.startsWith("ig:")) {
      instagram = part.slice(3).trim();
    }
    if (part.startsWith("in:")) {
      linkedin = part.slice(3).trim();
    }
  }

  return { instagram, linkedin };
}

export function getInstagramProfileUrl(value: string) {
  const handle = normalizeInstagramHandle(value);
  return handle ? `https://www.instagram.com/${handle}/` : "";
}

export function getInstagramDisplay(value: string) {
  const handle = normalizeInstagramHandle(value);
  return handle ? `@${handle}` : "";
}

export function getLinkedinProfileUrl(value: string) {
  const path = normalizeLinkedinPath(value);
  return path ? `https://www.linkedin.com/${path}` : "";
}

export function getLinkedinDisplay(value: string) {
  const path = normalizeLinkedinPath(value);
  return path ? `linkedin.com/${path}` : "";
}
