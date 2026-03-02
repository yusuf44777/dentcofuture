import { NextRequest, NextResponse } from "next/server";
import { getNetworkingFeed, isValidUuid } from "@/lib/networking/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSafeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (/SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL/i.test(message)) {
    return "Sunucu Supabase ortam degiskenleri eksik.";
  }

  if (
    /column .* does not exist|Could not find the .* column|schema cache|networking_profiles|networking_profile_actions/i.test(
      message
    )
  ) {
    return "Supabase networking semasi guncel degil. supabase/schema.sql dosyasini calistirin.";
  }

  if (process.env.NODE_ENV === "production") {
    return "Kart havuzu alinamadi.";
  }

  return message || "Kart havuzu alinamadi.";
}

export async function GET(request: NextRequest) {
  try {
    const profileId = request.nextUrl.searchParams.get("profileId")?.trim() ?? "";

    if (!isValidUuid(profileId)) {
      return NextResponse.json({ error: "Gecersiz profil kimligi." }, { status: 400 });
    }

    const feed = await getNetworkingFeed(profileId);
    if (!feed) {
      return NextResponse.json({ error: "Profil bulunamadi." }, { status: 404 });
    }

    return NextResponse.json(feed);
  } catch (error) {
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: 500 });
  }
}
