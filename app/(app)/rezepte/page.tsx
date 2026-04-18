import { Suspense } from "react"
import { RezeptePageClient } from "./rezepte-client";
import { fetchRecipes } from "@/lib/data/recipes";
import { Skeleton } from "@/components/ui/skeleton"

export const dynamic = "force-dynamic";

function RezepteSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[250px] w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

async function RezepteContent() {
  // We no longer fetch all foods here - we only need the recipes
  // Food data for recipes is now cached or hydrated lazily
  const recipes = await fetchRecipes();
  
  return <RezeptePageClient recipes={recipes} />;
}

export default function RezeptePage() {
  return (
    <Suspense fallback={<RezepteSkeleton />}>
      <RezepteContent />
    </Suspense>
  );
}
