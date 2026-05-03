import { Suspense } from "react";

import { ProduktionPageClient } from "./produktion-client";
import { fetchFoodsForInstitution } from "@/lib/data/foods";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchMenuPlans } from "@/lib/data/menu-plans";
import { FoodsProvider } from "@/components/foods-provider";
import { PageHeader } from "@/components/page-header";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { createClient } from "@/lib/supabase/server";

const PRODUCTION_HEADER = {
  title: "Produktionsmanagement",
  description: "Produktions- und Einkaufslisten aus dem aktiven Menüplan",
  helpText:
    "Listen werden automatisch aus dem aktiven Menüplan generiert. Änderungen im Wochenplan spiegeln sich direkt hier wider.",
};

async function ProductionContent() {
  const supabase = await createClient();
  const auditLog = writeAccessAuditLog(supabase, {
    action: "institution_workspace_accessed",
    targetType: "institution_workspace",
    targetId: "produktion",
    metadata: { route: "/institution/produktion" },
  });
  const [foods, recipes, menus] = await Promise.all([
    fetchFoodsForInstitution(),
    fetchRecipes(),
    fetchMenuPlans(),
  ]);
  await auditLog;
  return (
    <FoodsProvider foods={foods}>
      <ProduktionPageClient recipes={recipes} initialMenus={menus} />
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
