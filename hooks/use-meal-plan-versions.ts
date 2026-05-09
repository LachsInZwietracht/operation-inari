"use client"

import { useCallback, useEffect, useState } from "react";

import { fetchMealPlanVersionsClient } from "@/lib/data/meal-plan-versions-client";
import { isUuid } from "@/lib/data/local-records";
import type { MealPlanVersion } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";

export function useMealPlanVersions(mealPlanId?: string) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [versions, setVersions] = useState<MealPlanVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const canLoad = Boolean(mealPlanId && isUuid(mealPlanId) && isAuthenticated && !authLoading);

  const refresh = useCallback(async () => {
    if (!mealPlanId || !isUuid(mealPlanId) || !isAuthenticated) {
      setVersions([]);
      return;
    }

    setIsLoading(true);
    try {
      const nextVersions = await fetchMealPlanVersionsClient(mealPlanId, { limit: 10 });
      setVersions(nextVersions);
    } catch (error) {
      console.error("Failed to load meal plan versions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, mealPlanId]);

  useEffect(() => {
    if (!canLoad) {
      setVersions([]);
      return;
    }
    void refresh();
  }, [canLoad, refresh]);

  const recordVersion = useCallback((version: MealPlanVersion) => {
    setVersions((prev) => {
      const withoutDuplicate = prev.filter((item) => item.id !== version.id);
      return [version, ...withoutDuplicate]
        .sort((a, b) => b.versionNumber - a.versionNumber)
        .slice(0, 10);
    });
  }, []);

  return {
    versions,
    isLoading,
    refresh,
    recordVersion,
  };
}
