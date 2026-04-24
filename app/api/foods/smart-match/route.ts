import { NextResponse } from "next/server";
import { matchSmartInput, matchSmartInputMulti } from "@/lib/nlp-matching";
import { fetchFoodSearchIndex } from "@/lib/data/foods";
import type { Food } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { queries, returnCandidates, splitCompounds } = body;
    if (!Array.isArray(queries)) {
      return NextResponse.json({ error: "queries must be an array" }, { status: 400 });
    }

    // Load the lightweight index to serve as the "foods" array for nlp-matching
    const index = await fetchFoodSearchIndex();

    // Convert index to partial Food array as required by matching functions
    const partialFoods = index.map((item) => ({
      id: item.id,
      name: item.name,
    } as Food));

    if (returnCandidates || splitCompounds) {
      const results = queries.map((query: string) => {
        const resultSets = matchSmartInputMulti(query, partialFoods);
        return {
          query,
          resultSets,
        };
      });
      return NextResponse.json({ results });
    }

    const results = queries.map((query: string) => {
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
