import type { NextRequest } from "next/server";

export function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function readJsonBody<T extends Record<string, unknown>>(request: NextRequest) {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

export function getIdempotencyKey(request: NextRequest) {
  const key = request.headers.get("x-idempotency-key")?.trim() ?? "";
  return key.slice(0, 128);
}
