import { createSign } from "node:crypto";

const GOOGLE_OAUTH_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DEFAULT_GOOGLE_DRIVE_FOLDER_ID = "1QKdCWBWRWJAfPUWgd5QqhJHtLb8w6i95";

type GoogleDriveConfig = {
  clientEmail: string;
  privateKey: string;
  folderId: string;
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
        "Google Drive yedekleme pasif. GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL ve GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY tanımlı değil."
    };
  }

  try {
    const accessToken = await getAccessToken(config);
    const uploadResponse = await uploadToGoogleDrive(accessToken, config, input);

    return {
      status: "synced",
      fileId: uploadResponse.id,
      link: uploadResponse.webViewLink ?? null
    };
  } catch (error) {
    return {
      status: "failed",
      error: normalizeErrorMessage(error, "Google Drive yedeklemesi başarısız oldu.")
    };
  }
}

function getGoogleDriveConfig(): GoogleDriveConfig | null {
  const clientEmail = stripWrappingQuotes(
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL?.trim() ?? ""
  );
  const privateKeyRaw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
  const folderId =
    stripWrappingQuotes(process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() ?? "") ||
    DEFAULT_GOOGLE_DRIVE_FOLDER_ID;
  const privateKey = normalizePrivateKey(privateKeyRaw);

  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    clientEmail,
    privateKey,
    folderId
  };
}

async function getAccessToken(config: GoogleDriveConfig) {
  const cacheKey = `${config.clientEmail}:${config.folderId}`;
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

  const payload = (await response.json().catch(() => null)) as
    | {
        access_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      }
    | null;

  if (!response.ok || !payload?.access_token) {
    const description =
      payload?.error_description?.trim() || payload?.error?.trim() || "OAuth token alınamadı.";
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
): Promise<{ id: string; webViewLink?: string }> {
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

  const payload = (await response.json().catch(() => null)) as
    | {
        id?: string;
        webViewLink?: string;
        error?: { message?: string };
      }
    | null;

  if (!response.ok || !payload?.id) {
    const errorMessage = payload?.error?.message?.trim() || "Dosya Google Drive'a yüklenemedi.";
    throw new Error(`Google Drive upload hatası: ${errorMessage}`);
  }

  return {
    id: payload.id,
    webViewLink: payload.webViewLink
  };
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

function normalizeErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  const lower = message.toLowerCase();

  if (
    lower.includes("private key") ||
    lower.includes("pem") ||
    lower.includes("decoder routines")
  ) {
    return "Google Drive private key formatı geçersiz. Vercel env'de anahtarı tırnaksız ekleyin ve satır sonlarının doğru olduğundan emin olun.";
  }

  if (lower.includes("invalid_grant") || lower.includes("oauth")) {
    return "Google OAuth doğrulaması başarısız. Service account e-postası, private key ve Drive paylaşım izinlerini kontrol edin.";
  }

  if (lower.includes("insufficient") || lower.includes("permission")) {
    return "Google Drive klasörüne yazma izni yok. Klasörü service account e-postasıyla Editor olarak paylaşın.";
  }

  return message.slice(0, 400) || fallback;
}

function normalizePrivateKey(value: string) {
  const unwrapped = stripWrappingQuotes(value.trim());
  return unwrapped.replace(/\\n/g, "\n");
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
