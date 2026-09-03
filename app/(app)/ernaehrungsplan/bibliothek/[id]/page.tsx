import { notFound } from "next/navigation";

import { TemplateDetailClient } from "./template-detail-client";
import { MealPlanTemplateEditor } from "@/components/meal-plan-template-editor";
import { fetchPatients } from "@/lib/data/patients";
import { fetchFoodsViaRpc } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlanTemplates } from "@/lib/data/meal-plan-templates";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/verified-user";
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

  for (const day of template.dayBlocks?.length ? template.dayBlocks : [{ offsetDays: 0, slots: template.slots }]) {
    for (const slot of day.slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") ids.add(entry.referenceId);
      }
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
  searchParams: Promise<{ patientId?: string; returnDate?: string; scope?: string; edit?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const scope =
    query.scope === "patient" || query.scope === "general"
      ? query.scope
      : query.patientId
        ? "patient"
        : "general";
  const supabase = await createServerSupabaseClient();
  const user = await getVerifiedUser(supabase);

  const [recipes, templates] = await Promise.all([
    fetchRecipes(),
    fetchMealPlanTemplates({
      supabase,
      userId: user?.id,
      patientId: query.patientId,
    }),
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
      {query.edit === "true" ? <MealPlanTemplateEditor
        key={template.id}
        template={template}
        recipes={recipes}
        patients={(await fetchPatients(supabase)).map(({ id, firstName, lastName }) => ({ id, firstName, lastName }))}
        patientId={query.patientId}
        returnDate={query.returnDate}
        scope={scope}
      /> : <TemplateDetailClient
        template={template}
        recipes={recipes}
        nutrientIds={TEMPLATE_DETAIL_NUTRIENT_IDS}
        patientId={query.patientId}
        returnDate={query.returnDate}
        scope={scope}
      />}
    </FoodsProvider>
  );
}
