import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/api/errors";
import { fetchFoodSearchIndex } from "@/lib/data/foods";

/**
 * Compact API route to fetch the food search index.
 * Returns an Array of Arrays to minimize JSON overhead.
 * Format: [id, name, categoryId, sourceId, isCustom]
 *
 * Catalog data only (licensed BLS/SFK/OFF): requires an authenticated session
 * and is cached per browser, never on shared caches.
 */
export async function GET() {
  try {
    await requireApiUser();
  } catch (error) {
    return toErrorResponse(error);
  }

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
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("API search-index error:", error);
    return NextResponse.json({ error: "Search index unavailable" }, { status: 503 });
  }
}
