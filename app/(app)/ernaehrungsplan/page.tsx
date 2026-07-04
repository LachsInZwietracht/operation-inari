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

/** Today in the user-facing timezone; a mismatch is self-healed client-side. */
function todayInBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

/**
 * Foods for the active day's plan(s) and a template being applied — not for
 * every plan/template/recipe the user has. Everything else is batch-hydrated
 * on demand by the client (see the lazy hydration effect in the page client).
 */
function extractActiveFoodIds(
  recipes: Recipe[],
  mealPlans: DailyMealPlan[],
  templates: MealPlanTemplate[],
  activeDate: string,
  applyTemplateId?: string,
): string[] {
  const ids = new Set<string>();
  const recipeIds = new Set<string>();

  const collectSlots = (slots: DailyMealPlan["slots"] | MealPlanTemplate["slots"]) => {
    for (const slot of slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") {
          ids.add(entry.referenceId);
        } else {
          recipeIds.add(entry.referenceId);
        }
      }
    }
  };

  for (const plan of mealPlans) {
    if (plan.date === activeDate) collectSlots(plan.slots);
  }

  const applyTemplate = applyTemplateId
    ? templates.find((template) => template.id === applyTemplateId)
    : undefined;
  if (applyTemplate) collectSlots(applyTemplate.slots);

  for (const recipe of recipes) {
    if (recipeIds.has(recipe.id) || (recipe.legacyId && recipeIds.has(recipe.legacyId))) {
      for (const ingredient of recipe.ingredients) {
        ids.add(ingredient.foodId);
      }
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

  const foodIds = extractActiveFoodIds(
    recipes,
    mealPlans,
    templates,
    date ?? todayInBerlin(),
    template,
  );

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
