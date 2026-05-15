"use client";

import { useMemo } from "react";
import { FlaskConical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdditiveList } from "@/components/additive-list";
import { aggregatePlanAdditives } from "@/lib/additives";
import type { DailyMealPlan, Food, Recipe } from "@/lib/types";

interface PlanAdditiveSummaryProps {
  plan: DailyMealPlan;
  foodMap: Map<string, Food>;
  recipeMap: Map<string, Recipe>;
}

/**
 * Plan-side card that surfaces every E-Nummer used across the day's slots,
 * grouped by LMIV class with clinical warnings (phosphate, Aspartam/PKU,
 * Sulfite, Azofarbstoffe, …). Renders nothing when the plan is clean — that
 * keeps the sidebar tight for the common case while still flagging risk
 * combinations on plans that pull from heavily processed products.
 */
export function PlanAdditiveSummary({ plan, foodMap, recipeMap }: PlanAdditiveSummaryProps) {
  const summary = useMemo(
    () => aggregatePlanAdditives(plan, foodMap, recipeMap),
    [plan, foodMap, recipeMap],
  );

  if (summary.resolved.length === 0) {
    return null;
  }

  const distinctCodes = summary.resolved.length;
  const codeLabel = `${distinctCodes} ${distinctCodes === 1 ? "Zusatzstoff" : "Zusatzstoffe"} im Plan`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="text-muted-foreground h-4 w-4" />
          Zusatzstoffe
        </CardTitle>
        <CardDescription>{codeLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <AdditiveList codes={summary.resolved.map((a) => a.code)} variant="detailed" />
      </CardContent>
    </Card>
  );
}
