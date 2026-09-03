import { expect, test } from "@playwright/test";
import { summarizeTemplateForComparison, templateComparisonValue } from "@/lib/meal-plan-template-comparison";
import type { Food, MealPlanTemplate, MealSlot, Recipe } from "@/lib/types";

const food: Food = { id: "food", name: "Hafer", categoryId: "test", source: "test", baseAmount: 100, nutrients: [{ nutrientId: "energie", amount: 200 }, { nutrientId: "zucker", amount: 0 }], createdAt: "", updatedAt: "" };
const slots: MealSlot[] = [{ type: "fruehstueck", entries: [{ id: "entry", type: "food", referenceId: "food", amount: 150 }] }];
const template: MealPlanTemplate = { id: "template", name: "Vorlage", description: "", sourceType: "personal", slots };

test.describe("Template comparison calculations", () => {
  test("averages only filled days and retains relative gaps", () => {
    const summary = summarizeTemplateForComparison({ ...template, dayBlocks: [
      { offsetDays: 0, slots }, { offsetDays: 1, slots: [] }, { offsetDays: 6, slots },
    ] }, [food], new Map([[food.id, food]]), new Map());
    expect(summary).toMatchObject({ spanDays: 7, filledDays: 2, emptyDays: 5, entryCount: 2 });
    expect(templateComparisonValue(summary, "energie", "total")).toBe(600);
    expect(templateComparisonValue(summary, "energie", "average")).toBe(300);
    expect(templateComparisonValue(summary, "zucker", "average")).toBe(0);
    expect(templateComparisonValue(summary, "eiweiss", "average")).toBeNull();
  });

  test("does not fabricate totals for empty or unresolved entries", () => {
    for (const plan of [{ ...template, slots: [] }, template]) {
      const summary = summarizeTemplateForComparison(plan, [], new Map(), new Map());
      expect(templateComparisonValue(summary, "energie", "total")).toBeNull();
    }
  });

  test("scales recipes by servings and rejects partial nutrient coverage", () => {
    const recipe: Recipe = { id: "recipe", name: "Porridge", description: "", category: "test", servings: 2, prepTime: 0, cookTime: 0, ingredients: [{ foodId: "food", amount: 100 }], instructions: [], createdAt: "", updatedAt: "" };
    const recipeTemplate: MealPlanTemplate = { ...template, slots: [{ type: "fruehstueck", entries: [{ id: "recipe-entry", type: "recipe", referenceId: "recipe", amount: 3 }] }] };
    const summarize = (value: Recipe) => summarizeTemplateForComparison(recipeTemplate, [food], new Map([[food.id, food]]), new Map([[value.id, value]]));
    expect(templateComparisonValue(summarize(recipe), "energie", "average")).toBe(300);
    expect(templateComparisonValue(summarize({ ...recipe, ingredients: [...recipe.ingredients, { foodId: "missing", amount: 50 }] }), "energie", "total")).toBeNull();
  });
});
