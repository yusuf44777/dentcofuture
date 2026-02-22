import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

export const DASHBOARD_AUTH_COOKIE_NAME = "dashboard_auth";
const DASHBOARD_AUTH_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 saat
const DASHBOARD_PRIVATE_TOKEN_DEFAULT = "communitive-panel-2026";

function getDashboardUsername() {
  return process.env.DASHBOARD_USERNAME ?? "communitive";
}

function getDashboardPassword() {
  return process.env.DASHBOARD_PASSWORD ?? "communitiveİstanbul2026";
}

function getDashboardAuthSecret() {
  return process.env.DASHBOARD_AUTH_SECRET ?? process.env.CRON_SECRET ?? "change-this-secret";
}

function getDashboardPrivateToken() {
  return (process.env.DASHBOARD_PRIVATE_TOKEN ?? DASHBOARD_PRIVATE_TOKEN_DEFAULT).trim();
}

function createDashboardSessionToken() {
  return createHmac("sha256", getDashboardAuthSecret())
    .update(`${getDashboardUsername()}:${getDashboardPassword()}`)
    .digest("hex");
}

export function isDashboardCredentialValid(username: string, password: string) {
  return username === getDashboardUsername() && password === getDashboardPassword();
}

export function isDashboardSessionValid(token?: string) {
  if (!token) {
    return false;
  }

  const expected = createDashboardSessionToken();
  if (token.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function getDashboardSessionToken() {
  return createDashboardSessionToken();
}

export function getDashboardCookieMaxAge() {
  return DASHBOARD_AUTH_COOKIE_MAX_AGE;
}

export function getDashboardPrivatePath() {
  return "/konusmacipanel";
}

export function isDashboardPrivateTokenValid(token?: string) {
  if (!token) {
    return false;
  }

  const expected = getDashboardPrivateToken();
  if (token.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
