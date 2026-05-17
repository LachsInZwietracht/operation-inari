import { Suspense } from "react";

import { BerichteIndexClient } from "./berichte-index-client";
import { BerichtePageClient } from "./berichte-client";
import { fetchFoodsViaRpc } from "@/lib/data/foods";
import { fetchPatients } from "@/lib/data/patients";
import { fetchPatientReportsClient } from "@/lib/data/patient-reports-client";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
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

interface BerichteSearchParams {
  patientId?: string;
  planId?: string;
  protocolId?: string;
  reportId?: string;
  reportVersionId?: string;
}

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

async function IndexContent() {
  const supabase = await createServerSupabaseClient();
  const [reports, patients] = await Promise.all([
    fetchPatientReportsClient(undefined, supabase).catch((error) => {
      console.warn("Falling back to empty patient report list:", error);
      return [];
    }),
    fetchPatients(supabase),
  ]);

  return <BerichteIndexClient reports={reports} patients={patients} />;
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

function IndexSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader {...REPORTS_HEADER} />
      <div className="h-12 rounded-lg bg-muted animate-pulse" />
      <div className="space-y-3">
        <div className="h-24 rounded-xl border bg-muted animate-pulse" />
        <div className="h-24 rounded-xl border bg-muted animate-pulse" />
        <div className="h-24 rounded-xl border bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export default async function BerichtePage({
  searchParams,
}: {
  searchParams: Promise<BerichteSearchParams>;
}) {
  const params = await searchParams;
  const hasAnalyzerContext = Boolean(
    params.patientId ?? params.reportId ?? params.reportVersionId,
  );

  if (hasAnalyzerContext) {
    return (
      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsContent />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<IndexSkeleton />}>
      <IndexContent />
    </Suspense>
  );
}
