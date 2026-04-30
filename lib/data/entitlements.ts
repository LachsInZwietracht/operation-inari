import type { FoodSourceId } from "@/lib/types";

/**
 * Checks whether the current user/org can access a given data source.
 *
 * SFK is gated by the NEXT_PUBLIC_SFK_ENABLED feature flag until
 * billing via Polar.sh is wired. When billing is live, this function
 * becomes the single integration point for subscription-based gating.
 */
export function canAccessDataSource(sourceId: FoodSourceId): boolean {
  if (sourceId === "sfk") {
    return process.env.NEXT_PUBLIC_SFK_ENABLED === "true";
  }

  // All other sources are unrestricted
  return true;
}

/**
 * Returns the set of data source IDs the current environment can access.
 * Useful for filtering food queries server-side.
 */
export function getBlockedSourceIds(): FoodSourceId[] {
  const blocked: FoodSourceId[] = [];
  if (!canAccessDataSource("sfk")) {
    blocked.push("sfk");
  }
  return blocked;
}
