import { Suspense } from "react"
import { fetchAllFoodsForList } from "@/lib/data/foods"
import { fetchRecipes } from "@/lib/data/recipes"
import { fetchMealPlans } from "@/lib/data/meal-plans"
import { FoodsProvider } from "@/components/foods-provider"
import { DashboardPageClient } from "./dashboard-client"
import { Skeleton } from "@/components/ui/skeleton"

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

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}
