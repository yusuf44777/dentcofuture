import { NextRequest, NextResponse } from "next/server";
import { getNetworkingDiscovery, isValidUuid } from "@/lib/networking/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSafeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (/SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL/i.test(message)) {
    return "Sunucu Supabase ortam degiskenleri eksik.";
  }

  if (
    /column .* does not exist|Could not find the .* column|schema cache|networking_profiles/i.test(
      message
    )
  ) {
    return "Supabase networking semasi guncel degil. supabase/schema.sql dosyasini calistirin.";
  }

  if (process.env.NODE_ENV === "production") {
    return "Profil servisi hatasi.";
  }

  return message || "Profil servisi hatasi.";
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {};

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
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
