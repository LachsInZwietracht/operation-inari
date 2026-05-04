import { NextResponse } from "next/server";

import { resolveSsoByEmail } from "@/lib/data/sso";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = String(searchParams.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ matched: false }, { status: 400 });
  }

  try {
    const resolution = await resolveSsoByEmail(email);
    return NextResponse.json(resolution);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
