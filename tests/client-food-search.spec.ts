import { expect, test } from "@playwright/test";

import {
  availableFilters,
  energyPer100g,
  foodSubtitle,
  itemKcal,
  matchesFilter,
  type ClientSearchItem,
} from "@/lib/client-food-search";
import { clientCustomFoodKey } from "@/lib/data/client-custom-foods-client";

/**
 * The rules behind one search across foods, recipes and saved meals.
 *
 * The filters are the interesting part: they narrow *after* a hit is found,
 * which is the whole reason there are no source tabs. Nobody knows in advance
 * whether "Linsensuppe" is a catalog food, their counselor's recipe or the
 * meal they saved last week.
 */

function item(overrides: Partial<ClientSearchItem> = {}): ClientSearchItem {
  return {
    key: "food:1",
    kind: "food",
    id: "1",
    name: "Haferflocken",
    unit: "g",
    defaultAmount: 100,
    isOwn: false,
    ...overrides,
  };
}

test.describe("filters", () => {
  test("'Meine' cuts across kinds instead of being one of them", () => {
    const ownFood = item({ isOwn: true });
    const ownMeal = item({ kind: "meal", unit: "portion", isOwn: true });

    expect(matchesFilter(ownFood, "own")).toBe(true);
    expect(matchesFilter(ownMeal, "own")).toBe(true);
    expect(matchesFilter(item(), "own")).toBe(false);
  });

  test("a saved meal files under recipes rather than in a category of two", () => {
    expect(matchesFilter(item({ kind: "meal" }), "recipe")).toBe(true);
    expect(matchesFilter(item({ kind: "recipe" }), "recipe")).toBe(true);
    expect(matchesFilter(item(), "recipe")).toBe(false);
  });

  test("only filters that would find something are offered", () => {
    // A chip that leads to an empty list is a dead end.
    expect(availableFilters([item()])).toEqual([]);
    expect(availableFilters([item(), item({ kind: "recipe", key: "r" })])).toEqual([
      "alle",
      "food",
      "recipe",
    ]);
    expect(availableFilters([item(), item({ key: "own", isOwn: true })])).toEqual([
      "alle",
      "food",
      "own",
    ]);
  });

  test("nothing at all offers nothing", () => {
    expect(availableFilters([])).toEqual([]);
  });
});

test.describe("what a hit says about itself", () => {
  test("kcal follows the unit the item counts in", () => {
    expect(itemKcal(item({ kcalPerUnit: 350 }), 60)).toBe(210);
    expect(itemKcal(item({ kind: "recipe", unit: "portion", kcalPerUnit: 420 }), 2)).toBe(840);
  });

  test("an unpriced item reports no energy rather than zero", () => {
    expect(itemKcal(item(), 100)).toBeUndefined();
  });

  test("the subtitle is what tells six protein bars apart", () => {
    expect(foodSubtitle({ manufacturer: "Foodspring", isOwn: false })).toBe("Foodspring");
    expect(foodSubtitle({ isOwn: true })).toBe("Eigenes Lebensmittel");
    expect(foodSubtitle({ sourceId: "off", isOwn: false })).toBe("Open Food Facts");
    expect(foodSubtitle({ sourceId: "bls", isOwn: false })).toBe("Katalog");
  });

  test("energy is normalised to 100 g whatever the base amount was", () => {
    const nutrients = [{ nutrientId: "energie", amount: 74 }];
    expect(energyPer100g(nutrients, 20)).toBe(370);
    expect(energyPer100g(nutrients, 100)).toBe(74);
    expect(energyPer100g(undefined)).toBeUndefined();
    expect(energyPer100g(nutrients, 0)).toBeUndefined();
  });
});

test.describe("identity of a client's own product", () => {
  test("a barcode identifies it exactly, so a second scan lands on the first", () => {
    const key = clientCustomFoodKey("user-1", { barcode: "4001724819103", name: "Riegel" });
    expect(key).toBe("client:user-1:ean:4001724819103");
    // Same product, different name typed — still the same row.
    expect(clientCustomFoodKey("user-1", { barcode: "4001724819103", name: "Anders" })).toBe(key);
  });

  test("two people scanning the same product do not collide", () => {
    // `foods` is unique on (data_source_id, source_food_id); without the owner
    // in the key the second scan would overwrite the first person's nutrients.
    expect(clientCustomFoodKey("user-1", { barcode: "123", name: "x" })).not.toBe(
      clientCustomFoodKey("user-2", { barcode: "123", name: "x" }),
    );
  });

  test("a hand-entered product falls back to its name", () => {
    expect(clientCustomFoodKey("user-1", { name: "Omas Auflauf" })).toBe(
      "client:user-1:name:omas-auflauf",
    );
    // Typing it again is a correction, not a duplicate.
    expect(clientCustomFoodKey("user-1", { name: "  Omas   Auflauf  " })).toBe(
      "client:user-1:name:omas-auflauf",
    );
  });
});
