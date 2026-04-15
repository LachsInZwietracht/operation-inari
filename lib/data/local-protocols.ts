import type { Food, NutritionProtocol } from "@/lib/types";

import { normalizeProtocolFoodReferences } from "@/lib/data/food-reference-normalization";

const STORAGE_KEY = "prodi_protocols";

export function getLocalProtocols(foods: Food[] = []): NutritionProtocol[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    return (JSON.parse(raw) as NutritionProtocol[]).map((protocol) =>
      normalizeProtocolFoodReferences(protocol, foods),
    );
  } catch {
    return [];
  }
}

export function saveLocalProtocols(protocols: NutritionProtocol[], foods: Food[] = []) {
  if (typeof window === "undefined") return;

  const normalized = protocols.map((protocol) =>
    normalizeProtocolFoodReferences(protocol, foods),
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}
