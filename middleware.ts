import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Admin route protection is handled client-side with password
  // This middleware just ensures the route exists and is accessible
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
