import { Suspense } from "react"
import { fetchFoodsViaRpc } from "@/lib/data/foods"
import { fetchRecipes } from "@/lib/data/recipes"
import { fetchMealPlans } from "@/lib/data/meal-plans"
import { FoodsProvider } from "@/components/foods-provider"
import { DashboardPageClient } from "./dashboard-client"
import { Skeleton } from "@/components/ui/skeleton"
import type { DailyMealPlan, Recipe } from "@/lib/types"

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

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Skeleton className="col-span-4 h-[400px] w-full" />
        <Skeleton className="col-span-3 h-[400px] w-full" />
      </div>
    </div>
  )
}

async function DashboardContent() {
  // Step 1: Fetch recipes + meal plans (both cached)
  const [recipes, mealPlans] = await Promise.all([
    fetchRecipes(),
    fetchMealPlans({ limit: 5 }),
  ])

  // Step 2: Extract only referenced food IDs
  const foodIds = extractFoodIds(recipes, mealPlans)

  // Step 3: Fetch only those foods
  const foods = foodIds.length > 0
    ? await fetchFoodsViaRpc({ foodIds, nutrientIds: DASHBOARD_NUTRIENT_IDS })
    : []

  return (
    <FoodsProvider foods={foods}>
      <DashboardPageClient recipes={recipes} mealPlans={mealPlans} />
    </FoodsProvider>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}
