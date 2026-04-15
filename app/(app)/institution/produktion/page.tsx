import { Suspense } from "react";

import { ProduktionPageClient } from "./produktion-client";
import { fetchFoodsForInstitution } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { FoodsProvider } from "@/components/foods-provider";
import { PageHeader } from "@/components/page-header";

const PRODUCTION_HEADER = {
  title: "Produktionsmanagement",
  description: "Produktions- und Einkaufslisten aus dem aktiven Menüplan",
  helpText:
    "Listen werden automatisch aus dem aktiven Menüplan generiert. Änderungen im Wochenplan spiegeln sich direkt hier wider.",
};

async function ProductionContent() {
  const [foods, recipes] = await Promise.all([
    fetchFoodsForInstitution(),
    fetchRecipes(),
  ]);
  return (
    <FoodsProvider foods={foods}>
      <ProduktionPageClient recipes={recipes} />
    </FoodsProvider>
  );
}

function ProductionSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader {...PRODUCTION_HEADER} />
      <div className="h-12 w-40 rounded-md bg-muted animate-pulse" />
      <div className="h-64 rounded-xl border bg-muted animate-pulse" />
    </div>
  );
}

export default function ProduktionPage() {
  return (
    <Suspense fallback={<ProductionSkeleton />}>
      <ProductionContent />
    </Suspense>
  );
}
