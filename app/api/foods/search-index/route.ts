import { NextResponse } from "next/server";
import { fetchFoodSearchIndex } from "@/lib/data/foods";

/**
 * API route to fetch the food search index.
 * This is served with Next.js caching and can be consumed by client components.
 */
export async function GET() {
  try {
    const index = await fetchFoodSearchIndex();
    return NextResponse.json(index, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("API search-index error:", error);
    return NextResponse.json({ error: "Failed to load search index" }, { status: 500 });
  }
}
