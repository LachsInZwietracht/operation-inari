import { NextRequest, NextResponse } from "next/server";
import { fetchFoodsBrowserPage } from "@/lib/data/foods";
import type { FoodBrowserQuery } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const query: FoodBrowserQuery = {
    q: searchParams.get("q") ?? undefined,
    mode: (searchParams.get("mode") as FoodBrowserQuery["mode"]) ?? "name",
    categoryId: searchParams.get("categoryId"),
    dataSourceId: (searchParams.get("dataSourceId") as FoodBrowserQuery["dataSourceId"]) ?? "all",
    groupId: searchParams.get("groupId"),
    page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
    pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
  };

  try {
    const result = await fetchFoodsBrowserPage(query);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load foods";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
