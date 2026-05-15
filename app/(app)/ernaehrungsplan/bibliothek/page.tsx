import { BibliothekClient } from "./bibliothek-client";
import { fetchFoodsViaRpc } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlanTemplates } from "@/lib/data/meal-plan-templates";
import { FoodsProvider } from "@/components/foods-provider";
import type { MealPlanTemplate, Recipe } from "@/lib/types";

// Macro card display reuses the planner's headline nutrient set so the kcal /
// protein / carb / fibre totals shown on every Bibliothek card line up with
// what the user will see after applying the template to a day.
const BIBLIOTHEK_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  "ballaststoffe",
  "zucker",
  "natrium",
];

function extractFoodIds(recipes: Recipe[], templates: MealPlanTemplate[]): string[] {
  const ids = new Set<string>();

  for (const template of templates) {
    for (const slot of template.slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") ids.add(entry.referenceId);
      }
    }
  }

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      ids.add(ingredient.foodId);
    }
  }

  return Array.from(ids);
}

export default async function BibliothekPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; indication?: string }>;
}) {
  const { patientId, indication } = await searchParams;
  const [recipes, templates] = await Promise.all([
    fetchRecipes(),
    fetchMealPlanTemplates(),
  ]);

  const systemTemplates = templates.filter(
    (template) => template.sourceType === "system",
  );

  const foodIds = extractFoodIds(recipes, systemTemplates);
  const foods =
    foodIds.length > 0
      ? await fetchFoodsViaRpc({ foodIds, nutrientIds: BIBLIOTHEK_NUTRIENT_IDS })
      : [];

  return (
    <FoodsProvider foods={foods}>
      <BibliothekClient
        templates={systemTemplates}
        recipes={recipes}
        patientId={patientId}
        initialIndication={indication}
      />
    </FoodsProvider>
  );
}
