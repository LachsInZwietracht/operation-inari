import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO, subDays } from "date-fns";

import { calculateClientLogNutrients, CLIENT_LOG_NUTRIENT_IDS } from "@/lib/client-food-log";
import {
  averageOfLoggedDays,
  buildKcalSeries,
  CLIENT_STATS_WINDOW_DAYS,
  type ClientKcalDay,
} from "@/lib/client-stats";
import { isClientModuleEnabled } from "@/lib/client-modules";
import { summarizeExerciseProgress } from "@/lib/client-training";
import { fetchActiveLinksForClient } from "@/lib/data/client-links";
import { fetchClientFoodLogDays } from "@/lib/data/client-food-log-client";
import { fetchClientAdherence } from "@/lib/data/client-plan-client";
import { fetchClientWorkoutSessions } from "@/lib/data/client-training-client";
import { getNutrientValue } from "@/lib/nutrients";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ClientAdherenceDay, ClientExerciseProgress, Food } from "@/lib/types";

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
  adherence: ClientAdherenceDay[];
  progress: ClientExerciseProgress[];
}

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

/**
 * Energy per day for the window, including days with no entries.
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

  const kcalByDate = new Map(
    days.map((day) => [
      day.date,
      getNutrientValue(calculateClientLogNutrients(day.entries, foods), "energie"),
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
      adherence = await fetchClientAdherence(patientId, clientUserId, range, client);
    }
  }

  const progress = isClientModuleEnabled("training")
    ? summarizeExerciseProgress(await fetchClientWorkoutSessions(clientUserId, 60, client))
    : [];

  return { kcalByDay, averageKcal, adherence, progress };
}
