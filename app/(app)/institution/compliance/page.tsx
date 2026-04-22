import { fetchFoodsByIds } from "@/lib/data/foods";
import { fetchInpatientStays } from "@/lib/data/inpatient-stays";
import { fetchMealOrders } from "@/lib/data/meal-orders";
import { fetchMenuPlans } from "@/lib/data/menu-plans";
import { fetchPatientAllergens } from "@/lib/data/patient-allergens";
import { fetchRecipes } from "@/lib/data/recipes";
import { buildInstitutionAnalytics, collectActiveMenuFoodIds } from "@/lib/institution-analytics";
import { ComplianceClient } from "./compliance-client";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const [menus, recipes, stays, orders, patientAllergens] = await Promise.all([
    fetchMenuPlans(),
    fetchRecipes(),
    fetchInpatientStays(),
    fetchMealOrders(),
    fetchPatientAllergens(),
  ]);
  const foods = await fetchFoodsByIds(collectActiveMenuFoodIds(menus, recipes));

  const analytics = buildInstitutionAnalytics({
    menus,
    recipes,
    foods,
    stays,
    orders,
    patientAllergens,
  });

  return <ComplianceClient analytics={analytics} />;
}
