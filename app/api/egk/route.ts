import { NextResponse } from "next/server"

import { EGK_CARDS } from "@/lib/mock-data"

export async function GET() {
  const card = EGK_CARDS[Math.floor(Math.random() * EGK_CARDS.length)]
  return NextResponse.json({
    card,
    receivedAt: new Date().toISOString(),
    source: "companion",
  })
}
