import { Suspense } from "react";

import { BerichtePageClient } from "./berichte-client";
import { fetchFoodsForReports } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { FoodsProvider } from "@/components/foods-provider";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

const REPORTS_HEADER = {
  title: "Berichte",
  description: "Nährstoffanalyse und Auswertungen",
  helpText:
    "Erstellen Sie detaillierte Nährstoffanalysen Ihrer Ernährungspläne. Vergleichen Sie Ist- und Sollwerte nach DGE-Referenzen und exportieren Sie Berichte für Ihre Patienten.",
};

async function ReportsContent() {
  const [foods, recipes, mealPlans] = await Promise.all([
    fetchFoodsForReports(),
    fetchRecipes(),
    fetchMealPlans({ limit: 10 }),
  ]);
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
