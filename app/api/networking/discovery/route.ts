import { NextRequest, NextResponse } from "next/server";
import { getNetworkingDiscovery, isValidUuid } from "@/lib/networking/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSafeErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Networking onerileri alinamadi.";
  }

  return error instanceof Error ? error.message : "Networking onerileri alinamadi.";
}

export async function GET(request: NextRequest) {
  try {
    const profileId = request.nextUrl.searchParams.get("profileId")?.trim() ?? "";
    if (!isValidUuid(profileId)) {
      return NextResponse.json({ error: "Gecersiz profil kimligi." }, { status: 400 });
    }

    const discovery = await getNetworkingDiscovery(profileId);
    if (!discovery) {
      return NextResponse.json({ error: "Profil bulunamadi." }, { status: 404 });
    }

    return NextResponse.json(discovery);
  } catch (error) {
    return NextResponse.json(
      {
        error: getSafeErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
