"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { INSTITUTION_MENUS, RECIPES, FOODS } from "@/lib/mock-data";
import type {
  InstitutionMenu,
  InstitutionMealSlot,
  ProductionItem,
  ProductionIngredient,
  ShoppingItem,
} from "@/lib/types/institution";
import type { MealSlotType } from "@/lib/types/meal-plan";

const STORAGE_KEY = "institution-menus";

// ── Category mapping for shopping list ────────────────────────────

const FOOD_CATEGORY_MAP: Record<string, { categoryId: string; categoryName: string }> = {
  food_kartoffel: { categoryId: "cat_gemuese", categoryName: "Gemuese" },
  food_karotte: { categoryId: "cat_gemuese", categoryName: "Gemuese" },
  food_zwiebel: { categoryId: "cat_gemuese", categoryName: "Gemuese" },
  food_tomate: { categoryId: "cat_gemuese", categoryName: "Gemuese" },
  food_brokkoli: { categoryId: "cat_gemuese", categoryName: "Gemuese" },
  food_paprika: { categoryId: "cat_gemuese", categoryName: "Gemuese" },
  food_spinat: { categoryId: "cat_gemuese", categoryName: "Gemuese" },
  food_gurke: { categoryId: "cat_gemuese", categoryName: "Gemuese" },
  food_zucchini: { categoryId: "cat_gemuese", categoryName: "Gemuese" },
  food_haehnchenbrust: { categoryId: "cat_fleisch", categoryName: "Fleisch" },
  food_lachs: { categoryId: "cat_fisch", categoryName: "Fisch" },
  food_vollmilch: { categoryId: "cat_milch", categoryName: "Milchprodukte" },
  food_magerquark: { categoryId: "cat_milch", categoryName: "Milchprodukte" },
  food_gouda: { categoryId: "cat_milch", categoryName: "Milchprodukte" },
  food_haferflocken: { categoryId: "cat_getreide", categoryName: "Getreide" },
  food_vollkornbrot: { categoryId: "cat_getreide", categoryName: "Getreide" },
  food_reis: { categoryId: "cat_getreide", categoryName: "Getreide" },
  food_nudeln: { categoryId: "cat_getreide", categoryName: "Getreide" },
  food_rote_linsen: { categoryId: "cat_huelsen", categoryName: "Huelsenfruechte" },
  food_olivenoel: { categoryId: "cat_fette", categoryName: "Oele & Fette" },
  food_butter: { categoryId: "cat_fette", categoryName: "Oele & Fette" },
  food_heidelbeere: { categoryId: "cat_obst", categoryName: "Obst" },
  food_erdbeere: { categoryId: "cat_obst", categoryName: "Obst" },
  food_banane: { categoryId: "cat_obst", categoryName: "Obst" },
  food_honig: { categoryId: "cat_snacks", categoryName: "Snacks" },
};

const CATEGORY_COST_PER_KG: Record<string, number> = {
  Gemuese: 4,
  Fleisch: 12,
  Fisch: 15,
  Milchprodukte: 5,
  Getreide: 4,
  Huelsenfruechte: 6,
  "Oele & Fette": 10,
  Obst: 6,
  Snacks: 8,
};

const DEFAULT_CATEGORY = { categoryId: "cat_sonstiges", categoryName: "Sonstiges" };
const DEFAULT_COST_PER_KG = 6;

// ── Helpers ───────────────────────────────────────────────────────

function loadFromStorage(): InstitutionMenu[] {
  if (typeof window === "undefined") return INSTITUTION_MENUS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as InstitutionMenu[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Corrupted data – fall back to defaults
  }
  return INSTITUTION_MENUS;
}

function persistToStorage(menus: InstitutionMenu[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(menus));
  } catch {
    // Storage full or unavailable – silently ignore
  }
}

function now(): string {
  return new Date().toISOString();
}

function getCategoryInfo(foodId: string): { categoryId: string; categoryName: string } {
  return FOOD_CATEGORY_MAP[foodId] ?? DEFAULT_CATEGORY;
}

function getCostPerKg(categoryName: string): number {
  return CATEGORY_COST_PER_KG[categoryName] ?? DEFAULT_COST_PER_KG;
}

// ── Hook ──────────────────────────────────────────────────────────

export function useInstitutionMenu() {
  const [menus, setMenus] = useState<InstitutionMenu[]>(loadFromStorage);

  // Persist whenever menus change
  useEffect(() => {
    persistToStorage(menus);
  }, [menus]);

  const activeMenu = useMemo(
    () => menus.find((m) => m.status === "active"),
    [menus],
  );

  // ── Editing ───────────────────────────────────────────────────

  const assignRecipe = useCallback(
    (
      menuId: string,
      weekNumber: number,
      dayOfWeek: number,
      dietFormId: string,
      slotType: MealSlotType,
      recipeId: string,
      portionCount: number,
    ) => {
      setMenus((prev) =>
        prev.map((menu) => {
          if (menu.id !== menuId) return menu;

          const weeks = menu.weeks.map((week) => {
            if (week.weekNumber !== weekNumber) return week;

            const days = week.days.map((day) => {
              if (day.dayOfWeek !== dayOfWeek) return day;

              // Find or create diet menu for this diet form
              let found = false;
              const dietMenus = day.dietMenus.map((dm) => {
                if (dm.dietFormId !== dietFormId) return dm;
                found = true;

                // Replace existing slot or add new one
                const slotExists = dm.slots.some((s) => s.type === slotType);
                const newSlot: InstitutionMealSlot = {
                  type: slotType,
                  recipeId,
                  portionCount,
                };

                const slots = slotExists
                  ? dm.slots.map((s) => (s.type === slotType ? newSlot : s))
                  : [...dm.slots, newSlot];

                return { ...dm, slots };
              });

              if (!found) {
                dietMenus.push({
                  dietFormId,
                  slots: [{ type: slotType, recipeId, portionCount }],
                });
              }

              return { ...day, dietMenus };
            });

            // If the day doesn't exist yet, create it
            const dayExists = days.some((d) => d.dayOfWeek === dayOfWeek);
            if (!dayExists) {
              days.push({
                dayOfWeek,
                dietMenus: [
                  {
                    dietFormId,
                    slots: [{ type: slotType, recipeId, portionCount }],
                  },
                ],
              });
            }

            return { ...week, days };
          });

          return { ...menu, weeks, updatedAt: now() };
        }),
      );
    },
    [],
  );

  const removeRecipe = useCallback(
    (
      menuId: string,
      weekNumber: number,
      dayOfWeek: number,
      dietFormId: string,
      slotType: MealSlotType,
    ) => {
      setMenus((prev) =>
        prev.map((menu) => {
          if (menu.id !== menuId) return menu;

          const weeks = menu.weeks.map((week) => {
            if (week.weekNumber !== weekNumber) return week;

            const days = week.days.map((day) => {
              if (day.dayOfWeek !== dayOfWeek) return day;

              const dietMenus = day.dietMenus.map((dm) => {
                if (dm.dietFormId !== dietFormId) return dm;
                return {
                  ...dm,
                  slots: dm.slots.filter((s) => s.type !== slotType),
                };
              });

              return { ...day, dietMenus };
            });

            return { ...week, days };
          });

          return { ...menu, weeks, updatedAt: now() };
        }),
      );
    },
    [],
  );

  const updatePortionCount = useCallback(
    (
      menuId: string,
      weekNumber: number,
      dayOfWeek: number,
      dietFormId: string,
      slotType: MealSlotType,
      portionCount: number,
    ) => {
      setMenus((prev) =>
        prev.map((menu) => {
          if (menu.id !== menuId) return menu;

          const weeks = menu.weeks.map((week) => {
            if (week.weekNumber !== weekNumber) return week;

            const days = week.days.map((day) => {
              if (day.dayOfWeek !== dayOfWeek) return day;

              const dietMenus = day.dietMenus.map((dm) => {
                if (dm.dietFormId !== dietFormId) return dm;
                return {
                  ...dm,
                  slots: dm.slots.map((s) =>
                    s.type === slotType ? { ...s, portionCount } : s,
                  ),
                };
              });

              return { ...day, dietMenus };
            });

            return { ...week, days };
          });

          return { ...menu, weeks, updatedAt: now() };
        }),
      );
    },
    [],
  );

  // ── Production list ───────────────────────────────────────────

  const generateProductionList = useCallback(
    (menuId: string, weekNumber: number, dayOfWeek: number): ProductionItem[] => {
      const menu = menus.find((m) => m.id === menuId);
      if (!menu) return [];

      const week = menu.weeks.find((w) => w.weekNumber === weekNumber);
      if (!week) return [];

      const day = week.days.find((d) => d.dayOfWeek === dayOfWeek);
      if (!day) return [];

      const items: ProductionItem[] = [];

      for (const dietMenu of day.dietMenus) {
        for (const slot of dietMenu.slots) {
          const recipe = RECIPES.find((r) => r.id === slot.recipeId);
          if (!recipe) continue;

          const scale = slot.portionCount / recipe.servings;

          const ingredients: ProductionIngredient[] = recipe.ingredients.map(
            (ing) => {
              const food = FOODS.find((f) => f.id === ing.foodId);
              return {
                foodId: ing.foodId,
                foodName: food?.name ?? ing.foodId,
                totalAmount: Math.round(ing.amount * scale * 100) / 100,
                unit: "g",
              };
            },
          );

          items.push({
            recipeId: recipe.id,
            recipeName: recipe.name,
            dietFormId: dietMenu.dietFormId,
            mealSlot: slot.type,
            portionCount: slot.portionCount,
            ingredients,
          });
        }
      }

      return items;
    },
    [menus],
  );

  // ── Shopping list ─────────────────────────────────────────────

  const generateShoppingList = useCallback(
    (menuId: string, weekNumber: number): ShoppingItem[] => {
      const menu = menus.find((m) => m.id === menuId);
      if (!menu) return [];

      const week = menu.weeks.find((w) => w.weekNumber === weekNumber);
      if (!week) return [];

      // Aggregate ingredients by foodId across all days
      const aggregated = new Map<
        string,
        { foodName: string; totalAmount: number }
      >();

      for (const day of week.days) {
        for (const dietMenu of day.dietMenus) {
          for (const slot of dietMenu.slots) {
            const recipe = RECIPES.find((r) => r.id === slot.recipeId);
            if (!recipe) continue;

            const scale = slot.portionCount / recipe.servings;

            for (const ing of recipe.ingredients) {
              const food = FOODS.find((f) => f.id === ing.foodId);
              const foodName = food?.name ?? ing.foodId;
              const scaledAmount = ing.amount * scale;

              const existing = aggregated.get(ing.foodId);
              if (existing) {
                existing.totalAmount += scaledAmount;
              } else {
                aggregated.set(ing.foodId, {
                  foodName,
                  totalAmount: scaledAmount,
                });
              }
            }
          }
        }
      }

      // Convert to ShoppingItem array
      const items: ShoppingItem[] = [];

      for (const [foodId, data] of aggregated) {
        const { categoryId, categoryName } = getCategoryInfo(foodId);
        const costPerKg = getCostPerKg(categoryName);
        const totalAmount = Math.round(data.totalAmount * 100) / 100;
        const estimatedCost =
          Math.round((totalAmount / 1000) * costPerKg * 100) / 100;

        items.push({
          foodId,
          foodName: data.foodName,
          categoryId,
          categoryName,
          totalAmount,
          unit: "g",
          estimatedCost,
        });
      }

      // Sort by category then by name
      items.sort((a, b) => {
        const catCmp = a.categoryName.localeCompare(b.categoryName, "de");
        if (catCmp !== 0) return catCmp;
        return a.foodName.localeCompare(b.foodName, "de");
      });

      return items;
    },
    [menus],
  );

  return {
    menus,
    activeMenu,
    assignRecipe,
    removeRecipe,
    updatePortionCount,
    generateProductionList,
    generateShoppingList,
  };
}
