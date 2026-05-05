import { Buffer } from "node:buffer";
import { createSign } from "node:crypto";

const GOOGLE_OAUTH_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_FILE_FIELDS = "id,name,webViewLink,webContentLink,thumbnailLink";
const GOOGLE_DRIVE_UPLOAD_ENDPOINT =
  `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=${encodeURIComponent(GOOGLE_DRIVE_FILE_FIELDS)}`;
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DEFAULT_GOOGLE_DRIVE_FOLDER_ID = "1QKdCWBWRWJAfPUWgd5QqhJHtLb8w6i95";

type GoogleDriveAuthConfig =
  | {
      authMode: "service_account";
      clientEmail: string;
      privateKey: string;
    }
  | {
      authMode: "oauth_refresh_token";
      oauthClientId: string;
      oauthClientSecret: string;
      oauthRefreshToken: string;
    };

type GoogleDriveConfig = {
  authOptions: GoogleDriveAuthConfig[];
  folderId: string;
  makePublic: boolean;
};

type GoogleServiceAccountJson = {
  client_email?: string;
  private_key?: string;
};

type GoogleTokenCache = {
  accessToken: string;
  expiresAtMs: number;
  cacheKey: string;
};

let tokenCache: GoogleTokenCache | null = null;

export type GoogleDriveBackupResult =
  | {
      status: "disabled";
      error: string;
    }
  | {
      status: "synced";
      fileId: string;
      link: string | null;
      publicUrl: string | null;
    }
  | {
      status: "failed";
      error: string;
    };

export type GoogleDriveDeleteResult =
  | {
      status: "disabled";
      error: string;
    }
  | {
      status: "deleted";
    }
  | {
      status: "failed";
      error: string;
    };

type BackupInput = {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
};

export async function backupBytesToGoogleDrive(input: BackupInput): Promise<GoogleDriveBackupResult> {
  const config = getGoogleDriveConfig();
  if (!config) {
    return {
      status: "disabled",
      error:
        "Google Drive yedekleme pasif. OAuth refresh token veya service account ortam değişkenleri tanımlı değil."
    };
  }

  try {
    const accessToken = await getAccessToken(config);
    const uploadResponse = await uploadToGoogleDrive(accessToken, config, input);

    let publicUrl: string | null = null;
    if (config.makePublic) {
      await ensurePublicReadPermission(accessToken, uploadResponse.id);
      publicUrl = buildDrivePublicUrl(uploadResponse.id);
    }

    return {
      status: "synced",
      fileId: uploadResponse.id,
      link: uploadResponse.webViewLink ?? null,
      publicUrl
    };
  } catch (error) {
    return {
      status: "failed",
      error: normalizeErrorMessage(error, "Google Drive yedeklemesi başarısız oldu.")
    };
  }
}

export async function deleteFileFromGoogleDrive(fileId: string): Promise<GoogleDriveDeleteResult> {
  const trimmedFileId = fileId.trim();
  if (!trimmedFileId) {
    return {
      status: "deleted"
    };
  }

  const config = getGoogleDriveConfig();
  if (!config) {
    return {
      status: "disabled",
      error:
        "Google Drive silme pasif. OAuth refresh token veya service account ortam değişkenleri tanımlı değil."
    };
  }

  try {
    const accessToken = await getAccessToken(config);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(trimmedFileId)}?supportsAllDrives=true`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok && response.status !== 404) {
      const payload = await readResponseBody(response);
      const errorMessage = googleErrorMessage(
        payload,
        `HTTP ${response.status} ile silme başarısız oldu.`
      );
      throw new Error(`Google Drive silme hatası: ${errorMessage}`);
    }

    return {
      status: "deleted"
    };
  } catch (error) {
    return {
      status: "failed",
      error: normalizeErrorMessage(error, "Google Drive dosyası silinemedi.")
    };
  }
}

function getGoogleDriveConfig(): GoogleDriveConfig | null {
  const folderId =
    normalizeFolderId(stripWrappingQuotes(process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() ?? "")) ||
    DEFAULT_GOOGLE_DRIVE_FOLDER_ID;
  const makePublic = readBooleanEnv("GOOGLE_DRIVE_MAKE_PUBLIC", true);
  const authOptions: GoogleDriveAuthConfig[] = [];

  // OAuth refresh token yöntemi (kişisel Drive)
  const oauthClientId = stripWrappingQuotes(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim() ?? "");
  const oauthClientSecret = stripWrappingQuotes(
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim() ?? ""
  );
  const oauthRefreshToken = stripWrappingQuotes(
    process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?.trim() ?? ""
  );

  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    authOptions.push({
      authMode: "oauth_refresh_token",
      oauthClientId,
      oauthClientSecret,
      oauthRefreshToken
    });
  }

  // Service account yöntemi (Shared Drive)
  const credentialsFromJson = readGoogleServiceAccountFromEnv();
  const clientEmail =
    credentialsFromJson?.client_email?.trim() ||
    stripWrappingQuotes(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "");
  const privateKeyRaw =
    credentialsFromJson?.private_key ?? process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
  const privateKey = normalizePrivateKey(privateKeyRaw);

  if (!clientEmail || !privateKey) {
    return authOptions.length > 0 ? { authOptions, folderId, makePublic } : null;
  }

  authOptions.push({
    authMode: "service_account",
    clientEmail,
    privateKey
  });

  return authOptions.length > 0 ? { authOptions, folderId, makePublic } : null;
}

function readGoogleServiceAccountFromEnv(): GoogleServiceAccountJson | null {
  const rawBase64 = stripWrappingQuotes(
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64?.trim() ?? ""
  );
  if (rawBase64) {
    try {
      const decoded = Buffer.from(rawBase64, "base64").toString("utf8");
      const parsed = JSON.parse(decoded) as GoogleServiceAccountJson;
      return parsed;
    } catch {
      return null;
    }
  }

  const rawJson = stripWrappingQuotes(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim() ?? "");
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as GoogleServiceAccountJson;
      return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

async function getAccessToken(config: GoogleDriveConfig) {
  const failures: string[] = [];

  for (const authConfig of config.authOptions) {
    try {
      if (authConfig.authMode === "oauth_refresh_token") {
        return await getAccessTokenViaRefreshToken(authConfig);
      }
      return await getAccessTokenViaServiceAccount(authConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message.trim() : "Bilinmeyen hata";
      failures.push(`${authConfig.authMode}: ${message}`);
    }
  }

  throw new Error(`Google Drive kimlik doğrulaması başarısız: ${failures.join(" | ")}`);
}

async function getAccessTokenViaRefreshToken(config: {
  oauthClientId: string;
  oauthClientSecret: string;
  oauthRefreshToken: string;
}) {
  const cacheKey = `refresh:${config.oauthClientId}`;
  const nowMs = Date.now();
  if (tokenCache && tokenCache.cacheKey === cacheKey && tokenCache.expiresAtMs - 60_000 > nowMs) {
    return tokenCache.accessToken;
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.oauthClientId,
      client_secret: config.oauthClientSecret,
      refresh_token: config.oauthRefreshToken
    })
  });

  const payload = (await readResponseBody(response)) as
    | {
        access_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      }
    | null;

  if (!response.ok || !payload?.access_token) {
    const description = googleErrorMessage(payload, "OAuth token alınamadı.");
    throw new Error(`Google OAuth hatası: ${description}`);
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAtMs: nowMs + Math.max(300, payload.expires_in ?? 3600) * 1000,
    cacheKey
  };

  return payload.access_token;
}

async function getAccessTokenViaServiceAccount(config: {
  clientEmail: string;
  privateKey: string;
}) {
  const cacheKey = `sa:${config.clientEmail}`;
  const nowMs = Date.now();
  if (tokenCache && tokenCache.cacheKey === cacheKey && tokenCache.expiresAtMs - 60_000 > nowMs) {
    return tokenCache.accessToken;
  }

  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = issuedAt + 3600;
  const assertion = signGoogleServiceJwt({
    clientEmail: config.clientEmail,
    privateKey: config.privateKey,
    issuedAt,
    expiresAt
  });

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  const payload = (await readResponseBody(response)) as
    | {
        access_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      }
    | null;

  if (!response.ok || !payload?.access_token) {
    const description = googleErrorMessage(payload, "OAuth token alınamadı.");
    throw new Error(`Google OAuth hatası: ${description}`);
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAtMs: nowMs + Math.max(300, payload.expires_in ?? 300) * 1000,
    cacheKey
  };

  return payload.access_token;
}

function signGoogleServiceJwt(input: {
  clientEmail: string;
  privateKey: string;
  issuedAt: number;
  expiresAt: number;
}) {
  const header = base64UrlEncodeJson({
    alg: "RS256",
    typ: "JWT"
  });
  const payload = base64UrlEncodeJson({
    iss: input.clientEmail,
    scope: GOOGLE_DRIVE_SCOPE,
    aud: GOOGLE_OAUTH_TOKEN_ENDPOINT,
    iat: input.issuedAt,
    exp: input.expiresAt
  });
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(input.privateKey);

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function uploadToGoogleDrive(
  accessToken: string,
  config: GoogleDriveConfig,
  input: BackupInput
): Promise<{ id: string; webViewLink?: string; webContentLink?: string; thumbnailLink?: string }> {
  const boundary = `dentco_boundary_${Date.now().toString(36)}`;
  const metadata: {
    name: string;
    parents?: string[];
  } = {
    name: input.fileName
  };

  if (config.folderId) {
    metadata.parents = [config.folderId];
  }

  const preamble =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${input.mimeType}\r\n\r\n`;
  const ending = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(preamble), input.bytes, Buffer.from(ending)]);

  const response = await fetch(GOOGLE_DRIVE_UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": `multipart/related; boundary=${boundary}`,
      "content-length": String(body.length)
    },
    body
  });

  const payload = (await readResponseBody(response)) as
    | {
        id?: string;
        webViewLink?: string;
        webContentLink?: string;
        thumbnailLink?: string;
        error?: { message?: string };
      }
    | null;

  if (!response.ok || !payload?.id) {
    const errorMessage = googleErrorMessage(payload ?? {}, "Dosya Google Drive'a yüklenemedi.");
    throw new Error(`Google Drive upload hatası: ${errorMessage}`);
  }

  return {
    id: payload.id,
    webViewLink: payload.webViewLink,
    webContentLink: payload.webContentLink,
    thumbnailLink: payload.thumbnailLink
  };
}

async function ensurePublicReadPermission(accessToken: string, fileId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?fields=id&supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "anyone",
        role: "reader"
      })
    }
  );

  if (response.ok) {
    return;
  }

  const payload = await readResponseBody(response);
  const message = googleErrorMessage(payload, `HTTP ${response.status}`);
  const normalized = message.toLowerCase();

  if (normalized.includes("already") && normalized.includes("permission")) {
    return;
  }

  throw new Error(`Google Drive izin hatası: ${message}`);
}

function buildDrivePublicUrl(fileId: string) {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

function readBooleanEnv(name: string, defaultValue: boolean) {
  const rawValue = process.env[name];
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return defaultValue;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function base64UrlEncodeJson(value: Record<string, unknown>) {
  return base64UrlEncode(Buffer.from(JSON.stringify(value)));
}

function base64UrlEncode(value: Buffer) {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function readResponseBody(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: { message: text } };
  }
}

function googleErrorMessage(payload: Record<string, unknown> | null, fallback: string) {
  if (!payload) {
    return fallback;
  }

  const error = payload.error;
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  const description = payload.error_description;
  if (typeof description === "string" && description.trim()) {
    return description.trim();
  }

  return fallback;
}

function normalizeErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  const lower = message.toLowerCase();

  if (
    lower.includes("private key") ||
    lower.includes("pem") ||
    lower.includes("decoder routines")
  ) {
    return "Google Drive private key formatı geçersiz. Anahtarı tırnaksız girin veya GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 ile tüm service-account JSON'unu base64 olarak verin.";
  }

  if (lower.includes("invalid_grant")) {
    return "Google Drive OAuth refresh token geçersiz veya süresi dolmuş. Dentel'de çalışan OAuth client id, client secret ve refresh token değerlerini bu projeye de aynı şekilde girin.";
  }

  if (lower.includes("google drive kimlik doğrulaması başarısız")) {
    return `Google Drive kimlik doğrulaması başarısız. OAuth refresh token ve varsa service account ayarlarını kontrol edin. Detay: ${message.slice(0, 280)}`;
  }

  if (lower.includes("oauth")) {
    return "Google Drive OAuth doğrulaması başarısız. OAuth client id, client secret, refresh token ve Drive klasör erişimini kontrol edin.";
  }

  if (lower.includes("insufficient") || lower.includes("permission")) {
    return "Google Drive klasörüne yazma izni yok. Klasörü service account e-postasıyla Editor olarak paylaşın.";
  }

  return message.slice(0, 400) || fallback;
}

function normalizePrivateKey(value: string) {
  const unwrapped = stripWrappingQuotes(value.trim());
  if (!unwrapped) {
    return "";
  }

  let normalized = unwrapped;

  // Some UIs double-escape line breaks (\\n) or keep CRLF endings.
  normalized = normalized.replace(/\\r\\n/g, "\n");
  normalized = normalized.replace(/\\n/g, "\n");
  normalized = normalized.replace(/\r\n/g, "\n");
  normalized = normalized.replace(/\r/g, "\n");

  return normalized;
}

function normalizeFolderId(value: string) {
  const raw = value.trim();
  if (!raw) {
    return raw;
  }

  const fromPath = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1];
  if (fromPath) {
    return fromPath;
  }

  try {
    const url = new URL(raw);
    const idFromQuery = url.searchParams.get("id");
    if (idFromQuery) {
      return idFromQuery;
    }
  } catch {
    // Plain folder id.
  }

  return raw;
}

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
