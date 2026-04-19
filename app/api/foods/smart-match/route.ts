import { NextResponse } from "next/server";
import { matchSmartInput } from "@/lib/nlp-matching";
import { fetchFoodSearchIndex } from "@/lib/data/foods";
import type { Food } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { queries } = await request.json();
    if (!Array.isArray(queries)) {
      return NextResponse.json({ error: "queries must be an array" }, { status: 400 });
    }

    // Load the lightweight index to serve as the "foods" array for nlp-matching
    const index = await fetchFoodSearchIndex();
    
    // Convert index to partial Food array as required by matchSmartInput
    const partialFoods = index.map((item) => ({
      id: item.id,
      name: item.name,
      // We only need id and name for matchSmartInput's current implementation
    } as Food));

    const results = queries.map((query) => {
      const match = matchSmartInput(query, partialFoods);
      return {
        query,
        match,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("API smart-match error:", error);
    return NextResponse.json({ error: "Failed to process smart match" }, { status: 500 });
  }
}
