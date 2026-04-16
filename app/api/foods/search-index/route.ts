import { NextResponse } from "next/server";
import { fetchFoodSearchIndex } from "@/lib/data/foods";

/**
 * Compact API route to fetch the food search index.
 * Returns an Array of Arrays to minimize JSON overhead.
 * Format: [id, name, categoryId, sourceId, isCustom]
 */
export async function GET() {
  try {
    const index = await fetchFoodSearchIndex();
    
    // Convert objects to compact arrays
    const compact = index.map(item => [
      item.id,
      item.name,
      item.categoryId,
      item.sourceId,
      item.isCustom ? 1 : 0
    ]);

    return NextResponse.json(compact, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("API search-index error:", error);
    return NextResponse.json({ error: "Failed to load search index" }, { status: 500 });
  }
}
