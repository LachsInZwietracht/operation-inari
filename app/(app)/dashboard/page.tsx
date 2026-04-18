import { Suspense } from "react"
import { fetchFoodsViaRpc, fetchFoodSearchIndex } from "@/lib/data/foods"
import { fetchRecipes } from "@/lib/data/recipes"
import { fetchMealPlans } from "@/lib/data/meal-plans"
import { FoodsProvider } from "@/components/foods-provider"
import { DashboardMetricsClient } from "./dashboard-metrics-client"
import { DashboardNutritionClient } from "./dashboard-nutrition-client"
import { Skeleton } from "@/components/ui/skeleton"
import type { DailyMealPlan, Recipe } from "@/lib/types"

export const dynamic = "force-dynamic"

const DASHBOARD_NUTRIENT_IDS = [
  "energie", "eiweiss", "fett", "kohlenhydrate", "ballaststoffe",
  "gesaettigte_fettsaeuren", "ungesaettigte_fettsaeuren", "zucker",
  "natrium", "vitamin_c", "calcium", "eisen", "magnesium",
]

function extractFoodIds(recipes: Recipe[], mealPlans: DailyMealPlan[]): string[] {
  const ids = new Set<string>()

  for (const plan of mealPlans) {
    for (const slot of plan.slots) {
      for (const entry of slot.entries) {
        if (entry.type === "food") {
          ids.add(entry.referenceId)
        }
      }
    }
  }

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      ids.add(ingredient.foodId)
    }
  }

  return Array.from(ids)
}

function MetricsSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-48" />
      </div>
    </>
  )
}

function NutritionSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Skeleton className="h-[350px] w-full" />
      <Skeleton className="h-[350px] w-full" />
    </div>
  )
}

async function DashboardMetrics() {
  const [recipes, mealPlans, searchIndex] = await Promise.all([
    fetchRecipes(),
    fetchMealPlans({ limit: 5 }),
    fetchFoodSearchIndex(),
  ])

  return (
    <DashboardMetricsClient
      foodCount={searchIndex.length}
      recipeCount={recipes.length}
      todayPlan={mealPlans[0] ?? null}
    />
  )
}

async function DashboardNutritionSection() {
  const [recipes, mealPlans] = await Promise.all([
    fetchRecipes(),
    fetchMealPlans({ limit: 5 }),
  ])

  const foodIds = extractFoodIds(recipes, mealPlans)

  const foods = foodIds.length > 0
    ? await fetchFoodsViaRpc({ foodIds, nutrientIds: DASHBOARD_NUTRIENT_IDS })
    : []

  return (
    <FoodsProvider foods={foods}>
      <DashboardNutritionClient recipes={recipes} mealPlans={mealPlans} />
    </FoodsProvider>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<MetricsSkeleton />}>
        <DashboardMetrics />
      </Suspense>
      <Suspense fallback={<NutritionSkeleton />}>
        <DashboardNutritionSection />
      </Suspense>
    </div>
  )
}
