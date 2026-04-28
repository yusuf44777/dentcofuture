import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function removedResponse() {
  return NextResponse.json(
    { error: "Sohbet özelliği mobil uygulamadan kaldırıldı." },
    { status: 410 }
  );
}

export async function GET() {
  return removedResponse();
}

export async function POST() {
  return removedResponse();
}
