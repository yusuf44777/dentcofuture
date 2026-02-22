import { NextRequest } from "next/server";
import {
  DASHBOARD_AUTH_COOKIE_NAME,
  isDashboardSessionValid
} from "@/lib/auth/dashboard";

type ModeratorRequestAuthOptions = {
  secret?: string;
  secretHeaderName?: string;
};

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return "";
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

export function isModeratorRequestAuthorized(
  request: NextRequest,
  options: ModeratorRequestAuthOptions = {}
) {
  const sessionToken = request.cookies.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;
  if (isDashboardSessionValid(sessionToken)) {
    return true;
  }

  const secret = options.secret?.trim() ?? "";
  if (!secret) {
    return false;
  }

  const secretHeaderName = options.secretHeaderName ?? "x-raffle-secret";
  const bearerToken = getBearerToken(request);
  const headerSecret = request.headers.get(secretHeaderName)?.trim() ?? "";

  return bearerToken === secret || headerSecret === secret;
}
