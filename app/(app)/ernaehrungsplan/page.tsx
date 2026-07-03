import { ErnaehrungsplanPageClient } from "./ernaehrungsplan-client";
import { fetchFoodsByIdsCached } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { fetchMealPlanTemplates } from "@/lib/data/meal-plan-templates";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { FoodsProvider } from "@/components/foods-provider";
import type { DailyMealPlan, MealPlanTemplate, Recipe } from "@/lib/types";

const MEAL_PLAN_NUTRIENT_IDS = [
  "energie", "eiweiss", "fett", "kohlenhydrate", "ballaststoffe",
  "gesaettigte_fettsaeuren", "ungesaettigte_fettsaeuren", "zucker",
  "natrium", "vitamin_c", "calcium", "eisen", "magnesium",
  "vitamin_d", "kalium", "phosphor",
];

function extractFoodIds(
  recipes: Recipe[],
  mealPlans: DailyMealPlan[],
  templates: MealPlanTemplate[],
): string[] {
  const ids = new Set<string>();

  for (const plan of mealPlans) {
    for (const slot of plan.slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") {
          ids.add(entry.referenceId);
        }
      }
    }
  }

  for (const template of templates) {
    for (const slot of template.slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") {
          ids.add(entry.referenceId);
        }
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

export default async function ErnaehrungsplanPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; date?: string; template?: string }>;
}) {
  const { patientId, date, template } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [recipes, mealPlans, templates] = await Promise.all([
    fetchRecipes(),
    fetchMealPlans({ supabase, userId: user?.id, includeSystem: true }),
    fetchMealPlanTemplates({
      supabase,
      userId: user?.id,
      includeSystem: true,
    }),
  ]);

  const foodIds = extractFoodIds(recipes, mealPlans, templates);

  const foods =
    foodIds.length > 0
      ? await fetchFoodsByIdsCached({
          foodIds,
          nutrientIds: MEAL_PLAN_NUTRIENT_IDS,
          cacheKeyPrefix: "meal-plan-foods",
        })
      : [];

  return (
    <FoodsProvider foods={foods}>
      <ErnaehrungsplanPageClient
        recipes={recipes}
        initialPlans={mealPlans}
        initialTemplates={templates}
        patientId={patientId}
        initialDate={date}
        initialApplyTemplateId={template}
      />
    </FoodsProvider>
  );
}
