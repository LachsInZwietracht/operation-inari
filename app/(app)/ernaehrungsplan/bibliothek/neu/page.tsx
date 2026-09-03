import { FoodsProvider } from "@/components/foods-provider";
import { MealPlanTemplateEditor } from "@/components/meal-plan-template-editor";
import { fetchRecipes } from "@/lib/data/recipes";
import { fetchPatients } from "@/lib/data/patients";
import { fetchFoodsViaRpc } from "@/lib/data/foods";
import { createClient } from "@/lib/supabase/server";

export default async function NewTemplatePage({ searchParams }: {
  searchParams: Promise<{ patientId?: string; scope?: string; returnDate?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const [recipes, patients] = await Promise.all([fetchRecipes(), fetchPatients(supabase)]);
  const foodIds = [...new Set(recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.foodId)))];
  const foods = foodIds.length ? await fetchFoodsViaRpc({ foodIds }) : [];
  const patientId = patients.find((patient) => patient.id === query.patientId)?.id;
  return <FoodsProvider foods={foods}>
    <MealPlanTemplateEditor recipes={recipes} patients={patients.map(({ id, firstName, lastName }) => ({ id, firstName, lastName }))} patientId={patientId} scope={query.scope === "patient" || (query.scope !== "general" && patientId) ? "patient" : "general"} returnDate={query.returnDate} />
  </FoodsProvider>;
}
