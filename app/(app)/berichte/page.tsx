import { Suspense } from "react";

import { BerichtePageClient } from "./berichte-client";
import { fetchFoodsViaRpc } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { FoodsProvider } from "@/components/foods-provider";
import { PageHeader } from "@/components/page-header";
import type { DailyMealPlan, Recipe } from "@/lib/types";

export const dynamic = "force-dynamic";

const REPORT_NUTRIENT_IDS = [
  "energie", "eiweiss", "fett", "kohlenhydrate", "ballaststoffe",
  "gesaettigte_fettsaeuren", "ungesaettigte_fettsaeuren", "zucker",
  "natrium", "vitamin_c", "calcium", "eisen", "magnesium",
  "vitamin_a", "vitamin_b1", "vitamin_b2", "vitamin_b6", "vitamin_b12",
  "vitamin_d", "vitamin_e", "folsaeure", "niacin", "zink", "jod",
];

const REPORTS_HEADER = {
  title: "Berichte",
  description: "Nährstoffanalyse und Auswertungen",
  helpText:
    "Erstellen Sie detaillierte Nährstoffanalysen Ihrer Ernährungspläne. Vergleichen Sie Ist- und Sollwerte nach DGE-Referenzen und exportieren Sie Berichte für Ihre Patienten.",
};

function extractFoodIds(recipes: Recipe[], mealPlans: DailyMealPlan[]): string[] {
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

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      ids.add(ingredient.foodId);
    }
  }

  return Array.from(ids);
}

async function ReportsContent() {
  const [recipes, mealPlans] = await Promise.all([
    fetchRecipes(),
    fetchMealPlans({ limit: 10 }),
  ]);

  const foodIds = extractFoodIds(recipes, mealPlans);
  const foods = foodIds.length > 0
    ? await fetchFoodsViaRpc({ foodIds, nutrientIds: REPORT_NUTRIENT_IDS })
    : [];

  return (
    <FoodsProvider foods={foods}>
      <BerichtePageClient recipes={recipes} basePlans={mealPlans} />
    </FoodsProvider>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader {...REPORTS_HEADER} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 rounded-xl border bg-muted animate-pulse" />
        <div className="h-48 rounded-xl border bg-muted animate-pulse" />
      </div>
      <div className="space-y-3">
        <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
        <div className="h-52 rounded-xl border bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export default function BerichtePage() {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsContent />
    </Suspense>
  );
}
