import Constants from "expo-constants";
import { useAuthSessionStore } from "../store/auth-session";

const DEFAULT_API_BASE_URL = "https://dentcooutliers.vercel.app";

type ApiRequestOptions = {
  auth?: boolean;
  retryCount?: number;
  allowRefresh?: boolean;
};

function inferApiBaseUrlFromExpoHost() {
  const possibleHostValues = [
    Constants.expoConfig?.hostUri,
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2
      ?.extra?.expoClient?.hostUri
  ];

  for (const value of possibleHostValues) {
    if (typeof value !== "string" || value.trim().length === 0) {
      continue;
    }

    const host = value.split(":")[0]?.trim();
    if (!host) {
      continue;
    }

    return `http://${host}:3000`;
  }

  return "";
}

function getApiBaseUrl() {
  const fromExpoConfig = Constants.expoConfig?.extra?.apiBaseUrl;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const inferredFromExpoHost = inferApiBaseUrlFromExpoHost();
  const rawBaseUrl =
    typeof fromExpoConfig === "string" && fromExpoConfig.trim().length > 0
      ? fromExpoConfig
      : typeof fromEnv === "string" && fromEnv.trim().length > 0
        ? fromEnv
        : inferredFromExpoHost || DEFAULT_API_BASE_URL;

  if (!rawBaseUrl || rawBaseUrl.trim().length === 0) {
    throw new Error(
      "EXPO_PUBLIC_API_URL tanımlı değil. mobile/.env içine Next.js sunucusunun adresini yaz veya Expo host fallback'inin 3000 portuna erişebildiğinden emin ol."
    );
  }

  return rawBaseUrl.replace(/\/+$/, "");
}

function isHtmlDocumentPayload(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("<!doctype") || normalized.startsWith("<html");
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildHeaders(init?: HeadersInit) {
  const headers = new Headers(init ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

async function fetchWithRetry(url: string, init: RequestInit, retryCount: number) {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(url, init);
      if (response.status >= 500 && attempt < retryCount) {
        attempt += 1;
        await sleep(250 * attempt);
        continue;
      }

      return response;
    } catch (error) {
      if (attempt >= retryCount) {
        throw error;
      }

      attempt += 1;
      await sleep(250 * attempt);
    }
  }
}

async function refreshAccessToken() {
  const state = useAuthSessionStore.getState();
  const session = state.session;
  if (!session?.refreshToken) {
    throw new Error("Yenileme token bulunamadı.");
  }

  const response = await fetch(`${getApiBaseUrl()}/api/mobile/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refreshToken: session.refreshToken })
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: string;
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: number;
        user?: { email?: string };
      }
    | null;

  if (!response.ok || !payload?.accessToken || !payload.refreshToken) {
    throw new Error(payload?.error ?? "Oturum yenilenemedi.");
  }

  const nextSession = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAt: payload.expiresAt,
    email: payload.user?.email
  };

  await state.setSession(nextSession);

  return nextSession;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  options?: ApiRequestOptions
): Promise<T> {
  const auth = options?.auth ?? false;
  const retryCount = options?.retryCount ?? 2;
  const allowRefresh = options?.allowRefresh ?? true;
  const url = `${getApiBaseUrl()}${path}`;

  const state = useAuthSessionStore.getState();
  const session = state.session;
  if (auth && !session?.accessToken) {
    throw new Error("Bu işlem için oturum açmalısın.");
  }

  const headers = buildHeaders(init?.headers);
  if (auth && session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const executeRequest = () =>
    fetchWithRetry(
      url,
      {
        ...init,
        headers
      },
      retryCount
    );

  let response = await executeRequest();

  if (response.status === 401 && auth && allowRefresh && session?.refreshToken) {
    try {
      const refreshed = await refreshAccessToken();
      headers.set("Authorization", `Bearer ${refreshed.accessToken}`);
      response = await executeRequest();
    } catch {
      await useAuthSessionStore.getState().clear();
      throw new Error("Oturum süresi doldu. Lütfen tekrar giriş yap.");
    }
  }

  const contentType = response.headers.get("content-type") ?? "";
  let payload: (T & { error?: string; message?: string }) | null = null;
  let rawText = "";

  if (contentType.includes("application/json")) {
    payload = (await response.json().catch(() => null)) as
      | (T & { error?: string; message?: string })
      | null;
  } else {
    rawText = (await response.text().catch(() => "")).trim();
  }

  if (!response.ok) {
    const htmlFallbackMessage =
      rawText && isHtmlDocumentPayload(rawText)
        ? response.status === 404
          ? "İstenen API endpoint'i bulunamadı."
          : "Sunucudan beklenmeyen bir HTML yanıtı döndü."
        : "";

    const payloadErrorMessage = payload?.error ?? payload?.message ?? "";
    const detailedMessage =
      htmlFallbackMessage ||
      payloadErrorMessage ||
      (rawText ? rawText.slice(0, 220) : "");

    if (detailedMessage) {
      throw new Error(`HTTP ${response.status}: ${detailedMessage}`);
    }

    throw new Error(`Sunucu isteği başarısız oldu (HTTP ${response.status}).`);
  }

  if (!payload) {
    throw new Error("Sunucudan boş yanıt döndü.");
  }

  return payload;
}
