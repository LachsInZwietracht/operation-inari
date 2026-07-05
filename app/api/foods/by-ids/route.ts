import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/api/errors";
import { fetchFoodsViaRpc } from "@/lib/data/foods";

export async function POST(request: Request) {
  try {
    await requireApiUser();
  } catch (error) {
    return toErrorResponse(error);
  }

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

    // The RPC runs with the service-role client (bypasses RLS); custom foods
    // are tenant-scoped and must not be fetchable cross-tenant by ID. Own
    // custom foods load through the RLS-scoped fetchCustomFoodByIdClient.
    return NextResponse.json(foods.filter((food) => !food.isCustom));
  } catch (error) {
    console.error("POST /api/foods/by-ids error:", error);
    return NextResponse.json(
      { error: "Failed to fetch foods" },
      { status: 500 },
    );
  }
}
