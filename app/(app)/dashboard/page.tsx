import { fetchAllFoodsForList } from "@/lib/data/foods"
import { fetchRecipes } from "@/lib/data/recipes"
import { fetchMealPlans } from "@/lib/data/meal-plans"
import { FoodsProvider } from "@/components/foods-provider"
import { DashboardPageClient } from "./dashboard-client"

export default async function DashboardPage() {
  const [foods, recipes, mealPlans] = await Promise.all([
    fetchAllFoodsForList(),
    fetchRecipes(),
    fetchMealPlans({ limit: 5 }),
  ])

  return (
    <FoodsProvider foods={foods}>
      <DashboardPageClient recipes={recipes} mealPlans={mealPlans} />
    </FoodsProvider>
  )
}
