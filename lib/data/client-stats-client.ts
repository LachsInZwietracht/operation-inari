import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO, subDays } from "date-fns";

import { calculateClientDayNutrients, CLIENT_LOG_NUTRIENT_IDS } from "@/lib/client-food-log";
import {
  averageOfLoggedDays,
  buildKcalSeries,
  CLIENT_STATS_WINDOW_DAYS,
  type ClientKcalDay,
} from "@/lib/client-stats";
import { isClientModuleEnabled } from "@/lib/client-modules";
import { summarizeExerciseProgress } from "@/lib/client-training";
import { estimateActivityEnergy } from "@/lib/energy-expenditure";
import { fetchActiveLinksForClient } from "@/lib/data/client-links";
import { fetchClientFoodLogDays } from "@/lib/data/client-food-log-client";
import {
  fetchClientAdherence,
  fetchClientMealCompletionsForPlans,
  fetchClientPlanDays,
} from "@/lib/data/client-plan-client";
import { fetchClientPlanFacts } from "@/lib/data/client-plan-nutrition-client";
import { fetchClientWorkoutSessions } from "@/lib/data/client-training-client";
import { getNutrientValue } from "@/lib/nutrients";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  ClientAdherenceDay,
  ClientExerciseProgress,
  ClientMealCompletion,
  ClientPlanDay,
  ClientPlanEntryFacts,
  Food,
} from "@/lib/types";

/**
 * The statistics module is a read-only aggregator: it is the one client module
 * that reads the others rather than owning data of its own, and it has no
 * migration because it stores nothing.
 *
 * The dependency runs one way only — nothing reads back from here — and every
 * section is guarded by `isClientModuleEnabled`, so switching a module off
 * makes its section disappear instead of breaking this page.
 */

export interface ClientStats {
  kcalByDay: ClientKcalDay[];
  averageKcal: number;
  /** Estimated energy spent training, same window and same unit as the food. */
  burnedByDay: ClientKcalDay[];
  adherence: ClientAdherenceDay[];
  progress: ClientExerciseProgress[];
}

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

/**
 * Energy per day for the window, including days with no entries.
 *
 * Counts both halves of the day — what was typed into the diary and what was
 * ticked off the plan. Reading only the diary was what made a client who
 * followed their plan perfectly show up here as a flat zero.
 *
 * Gaps are filled with zero on purpose: a diary with holes should look like a
 * diary with holes, not like a shorter, tidier one.
 */
async function loadKcalByDay(
  clientUserId: string,
  range: { from: string; to: string },
  supabase: SupabaseClient,
): Promise<ClientKcalDay[]> {
  const days = await fetchClientFoodLogDays(clientUserId, range, supabase);

  const foodIds = [
    ...new Set(
      days.flatMap((day) =>
        day.entries.map((entry) => entry.foodId).filter((id): id is string => Boolean(id)),
      ),
    ),
  ];

  let foods = new Map<string, Food>();
  if (foodIds.length > 0) {
    const response = await fetch("/api/foods/by-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: foodIds, nutrientIds: CLIENT_LOG_NUTRIENT_IDS }),
    });
    if (response.ok) {
      const loaded = (await response.json()) as Food[];
      foods = new Map(loaded.map((food) => [food.id, food]));
    }
  }

  // The plan side, guarded like every other cross-module read here.
  let plans: ClientPlanDay[] = [];
  let planFacts = new Map<string, ClientPlanEntryFacts>();
  const completions = new Map<string, ClientMealCompletion>();
  if (isClientModuleEnabled("plan")) {
    plans = await fetchClientPlanDays(range, supabase);
    if (plans.length > 0) {
      planFacts = await fetchClientPlanFacts(plans, supabase);
      const rows = await fetchClientMealCompletionsForPlans(
        clientUserId,
        plans.map((plan) => plan.id),
        supabase,
      );
      for (const row of rows) completions.set(row.mealEntryId, row);
    }
  }

  const dates = [...new Set([...days.map((d) => d.date), ...plans.map((p) => p.date)])];
  const logByDate = new Map(days.map((day) => [day.date, day]));
  const planByDate = new Map(plans.map((plan) => [plan.date, plan]));

  const kcalByDate = new Map(
    dates.map((date) => [
      date,
      getNutrientValue(
        calculateClientDayNutrients({
          entries: logByDate.get(date)?.entries ?? [],
          foods,
          planEntries: planByDate.get(date)?.entries ?? [],
          completions,
          planFacts,
        }),
        "energie",
      ),
    ]),
  );

  return buildKcalSeries(kcalByDate, range.to);
}

/**
 * Everything the statistics page shows, for the signed-in client.
 *
 * One call rather than three so the page has a single loading state; a
 * half-rendered dashboard is worse than a slightly slower one.
 */
export async function fetchClientStats(
  clientUserId: string,
  today: string,
  supabase?: SupabaseClient,
): Promise<ClientStats> {
  const client = resolveClient(supabase);
  const range = {
    from: format(subDays(parseISO(today), CLIENT_STATS_WINDOW_DAYS - 1), "yyyy-MM-dd"),
    to: today,
  };

  const kcalByDay = isClientModuleEnabled("tagebuch")
    ? await loadKcalByDay(clientUserId, range, client)
    : [];

  const averageKcal = averageOfLoggedDays(kcalByDay);

  let adherence: ClientAdherenceDay[] = [];
  if (isClientModuleEnabled("plan")) {
    // Plan adherence only exists relative to a counselor's plan, so it needs
    // the link. Without one the section simply has nothing to say.
    const links = await fetchActiveLinksForClient(client, clientUserId);
    const patientId = links[0]?.patientId;
    if (patientId) {
      adherence = (await fetchClientAdherence(patientId, clientUserId, range, client)).byDay;
    }
  }

  let progress: ClientExerciseProgress[] = [];
  let burnedByDay: ClientKcalDay[] = [];
  if (isClientModuleEnabled("training")) {
    const sessions = await fetchClientWorkoutSessions(clientUserId, 60, client);
    progress = summarizeExerciseProgress(sessions);

    // Derived here rather than stored on the session, from the weight recorded
    // at the time. Sessions with no duration contribute nothing instead of a
    // guess, so the series shows what was measured, not what was assumed.
    const burnedByDate = new Map<string, number>();
    for (const session of sessions) {
      const energy = estimateActivityEnergy({
        activityId: session.activityKind,
        intensity: session.intensity,
        minutes: session.durationMinutes,
        weightKg: session.bodyWeightKg,
      });
      if (!energy) continue;
      burnedByDate.set(session.date, (burnedByDate.get(session.date) ?? 0) + energy.netKcal);
    }
    burnedByDay = buildKcalSeries(burnedByDate, range.to);
  }

  return { kcalByDay, averageKcal, burnedByDay, adherence, progress };
}
