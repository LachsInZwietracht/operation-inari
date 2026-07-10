import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/api/errors";
import { fetchFoodsBrowserPage } from "@/lib/data/foods";
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import type { FoodBrowserQuery } from "@/lib/types";

const VALID_NUTRIENT_IDS = new Set(NUTRIENT_DEFINITIONS.map((definition) => definition.id));

export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
  } catch (error) {
    return toErrorResponse(error);
  }

  const { searchParams } = request.nextUrl;

  const nutrientMinParam = searchParams.get("nutrientMin");
  const nutrientMaxParam = searchParams.get("nutrientMax");
  const nutrientSortParam = searchParams.get("nutrientSort");

  const query: FoodBrowserQuery = {
    q: searchParams.get("q") ?? undefined,
    mode: (searchParams.get("mode") as FoodBrowserQuery["mode"]) ?? "name",
    categoryId: searchParams.get("categoryId"),
    dataSourceId: (searchParams.get("dataSourceId") as FoodBrowserQuery["dataSourceId"]) ?? "all",
    groupId: searchParams.get("groupId"),
    nutrientId: searchParams.get("nutrientId"),
    nutrientMin:
      nutrientMinParam != null && nutrientMinParam !== "" ? Number(nutrientMinParam) : null,
    nutrientMax:
      nutrientMaxParam != null && nutrientMaxParam !== "" ? Number(nutrientMaxParam) : null,
    nutrientSort:
      nutrientSortParam === "asc" || nutrientSortParam === "desc" ? nutrientSortParam : null,
    includePortions: searchParams.get("includePortions") === "1",
    extraNutrientIds: (searchParams.get("nutrientIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => VALID_NUTRIENT_IDS.has(id)),
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
    return toErrorResponse(error);
  }
}
