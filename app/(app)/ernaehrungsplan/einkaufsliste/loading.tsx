import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level skeleton shown while the server aggregates plans, recipes and
 * food data for the shopping list. Mirrors the page layout: header, plan
 * picker card and list card.
 */
export default function EinkaufslisteLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
