import { notFound } from "next/navigation";

import { TemplateDetailClient } from "./template-detail-client";
import { fetchFoodsViaRpc } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlanTemplates } from "@/lib/data/meal-plan-templates";
import { FoodsProvider } from "@/components/foods-provider";
import type { MealPlanTemplate, Recipe } from "@/lib/types";

// Same nutrient coverage as the planner — the detail view shows the full day
// totals plus reference comparison, and any missing nutrient would show as 0
// instead of dashes if we shrunk this list.
const TEMPLATE_DETAIL_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "kohlenhydrate",
  "ballaststoffe",
  "gesaettigte_fettsaeuren",
  "ungesaettigte_fettsaeuren",
  "zucker",
  "natrium",
  "vitamin_c",
  "calcium",
  "eisen",
  "magnesium",
  "vitamin_d",
  "kalium",
  "phosphor",
];

function extractFoodIds(recipes: Recipe[], template: MealPlanTemplate): string[] {
  const ids = new Set<string>();

  for (const slot of template.slots) {
    for (const entry of slot.entries) {
      if (entry.type === "food") ids.add(entry.referenceId);
    }
  }

  // Recipe ingredients only matter for recipes the template actually references,
  // but pulling all of them is cheap and avoids per-recipe lookups; the recipe
  // list is small enough that hydrating every ingredient food keeps the detail
  // page snappy without conditional fetches.
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      ids.add(ingredient.foodId);
    }
  }

  return Array.from(ids);
}

export default async function BibliothekDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ patientId?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [recipes, templates] = await Promise.all([
    fetchRecipes(),
    fetchMealPlanTemplates(),
  ]);

  const template = templates.find(
    (item) => item.id === id || item.legacyId === id,
  );
  if (!template) {
    notFound();
  }

  const foodIds = extractFoodIds(recipes, template);
  const foods =
    foodIds.length > 0
      ? await fetchFoodsViaRpc({
          foodIds,
          nutrientIds: TEMPLATE_DETAIL_NUTRIENT_IDS,
        })
      : [];

  return (
    <FoodsProvider foods={foods}>
      <TemplateDetailClient
        template={template}
        recipes={recipes}
        nutrientIds={TEMPLATE_DETAIL_NUTRIENT_IDS}
        patientId={query.patientId}
      />
    </FoodsProvider>
  );
}
