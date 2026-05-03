import { fetchFoodsByIds } from "@/lib/data/foods";
import { fetchInpatientStays } from "@/lib/data/inpatient-stays";
import { fetchMealOrders } from "@/lib/data/meal-orders";
import { fetchMenuPlans } from "@/lib/data/menu-plans";
import { fetchPatientAllergens } from "@/lib/data/patient-allergens";
import { fetchRecipes } from "@/lib/data/recipes";
import { buildInstitutionAnalytics, collectActiveMenuFoodIds } from "@/lib/institution-analytics";
import { InstitutionStatistikenClient } from "./statistiken-client";
import { writeAccessAuditLog } from "@/lib/audit/access-audit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InstitutionStatistikenPage() {
  const supabase = await createClient();
  const auditLog = writeAccessAuditLog(supabase, {
    action: "institution_analytics_accessed",
    targetType: "institution_analytics",
    targetId: "statistiken",
    metadata: { route: "/institution/statistiken" },
  });
  const [menus, recipes, stays, orders, patientAllergens] = await Promise.all([
    fetchMenuPlans(),
    fetchRecipes(),
    fetchInpatientStays(),
    fetchMealOrders(),
    fetchPatientAllergens(),
  ]);
  await auditLog;
  const foods = await fetchFoodsByIds(collectActiveMenuFoodIds(menus, recipes));

  const analytics = buildInstitutionAnalytics({
    menus,
    recipes,
    foods,
    stays,
    orders,
    patientAllergens,
  });

  return <InstitutionStatistikenClient analytics={analytics} />;
}
