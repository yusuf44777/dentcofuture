import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "OTP girisi kaldirildi. E-posta + telefon ile giris yapin."
    },
    { status: 410 }
  );
}
