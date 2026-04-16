import { NextResponse } from "next/server";
import { fetchFoodsViaRpc } from "@/lib/data/foods";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ids: string[] = body.ids;
    const nutrientIds: string[] | undefined = body.nutrientIds;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // Cap at 500 IDs per request to prevent abuse
    const cappedIds = ids.slice(0, 500);

    const foods = await fetchFoodsViaRpc({
      foodIds: cappedIds,
      nutrientIds,
    });

    return NextResponse.json(foods);
  } catch (error) {
    console.error("POST /api/foods/by-ids error:", error);
    return NextResponse.json(
      { error: "Failed to fetch foods" },
      { status: 500 },
    );
  }
}
