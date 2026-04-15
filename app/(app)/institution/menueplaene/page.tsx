import { Suspense } from "react";

import { MenueplaenePageClient } from "./menueplaene-client";
import { fetchFoodsForInstitution } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { FoodsProvider } from "@/components/foods-provider";
import { PageHeader } from "@/components/page-header";

const MENU_HEADER = {
  title: "Menüplanung",
  description: "Wöchentliche und zyklische Menüpläne für die Einrichtung",
  helpText:
    "Ziehen Sie Rezepte aus der Seitenleiste in die Wochenübersicht. Sie können Portionen direkt in der Zelle anpassen oder Zuweisungen per Klick entfernen. Unter den Tabs Produktion und Einkauf werden Listen automatisch aus dem aktiven Plan generiert.",
};

async function MenuPlansContent() {
  const [foods, recipes] = await Promise.all([
    fetchFoodsForInstitution(),
    fetchRecipes(),
  ]);
  return (
    <FoodsProvider foods={foods}>
      <MenueplaenePageClient recipes={recipes} />
    </FoodsProvider>
  );
}

function MenuPlansSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader {...MENU_HEADER} />
      <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
      <div className="h-72 rounded-xl border bg-muted animate-pulse" />
    </div>
  );
}

export default function MenueplaenePage() {
  return (
    <Suspense fallback={<MenuPlansSkeleton />}>
      <MenuPlansContent />
    </Suspense>
  );
}
