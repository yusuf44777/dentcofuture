import Constants from "expo-constants";

const DEFAULT_API_BASE_URL = "https://dentcofuture.vercel.app";

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
      "EXPO_PUBLIC_API_URL tanimli degil. mobile/.env icine Next.js sunucusunun adresini yaz veya Expo host fallback'inin 3000 portuna erisebildiginden emin ol."
    );
  }

  return rawBaseUrl.replace(/\/+$/, "");
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Sunucu istegi basarisiz oldu.");
  }

  if (!payload) {
    throw new Error("Sunucudan bos yanit dondu.");
  }

  return payload;
}
