import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO, subDays } from "date-fns";

import { collectClientDayParts, eatenAmount } from "@/lib/client-food-log";
import { buildClientDayFactRows, type ClientDayFactInput, type ClientDayFactRow } from "@/lib/client-checkin";
import { fetchClientCheckins } from "@/lib/data/client-checkin-client";
import { isClientCapabilityEnabled } from "@/lib/client-modules";
import {
  averageOfLoggedDays,
  buildKcalSeries,
  CLIENT_CHECKIN_WINDOW_DAYS,
  CLIENT_STATS_WINDOW_DAYS,
  summarizeTrainingWeeks,
  type ClientKcalDay,
  type ClientTrainingWeek,
} from "@/lib/client-stats";
import { isClientModuleEnabled } from "@/lib/client-modules";
import { findPersonalRecords, setVolumeKg, summarizeExerciseProgress } from "@/lib/client-training";
import { estimateActivityEnergy } from "@/lib/energy-expenditure";
import { fetchActiveLinksForClient } from "@/lib/data/client-links";
import { fetchClientFoodLogDays } from "@/lib/data/client-food-log-client";
import {
  fetchClientAdherence,
  fetchClientMealCompletionsForPlans,
  fetchClientPlanDays,
} from "@/lib/data/client-plan-client";
import {
  fetchClientPlanFacts,
  fetchClientRecipeFacts,
} from "@/lib/data/client-plan-nutrition-client";
import { hydrateClientFoods } from "@/lib/data/client-custom-foods-client";
import { fetchClientWorkoutSessions } from "@/lib/data/client-training-client";
import { getNutrientValue, sumNutrients } from "@/lib/nutrients";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  ClientAdherenceDay,
  ClientCheckin,
  ClientExerciseProgress,
  ClientMealCompletion,
  ClientPlanDay,
  ClientPersonalRecord,
  ClientPlanEntryFacts,
  NutrientValue,
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
  /**
   * The window as unsummed parts, oldest first — the raw material the
   * micronutrient trends are built from. Kept unsummed because which source
   * carried data for what is exactly what a sum destroys, and combined with
   * the reference intake by the caller, which already holds it.
   */
  dayParts: { date: string; parts: NutrientValue[][] }[];
  adherence: ClientAdherenceDay[];
  progress: ClientExerciseProgress[];
  /** Training by week — the grain people actually plan in. */
  trainingWeeks: ClientTrainingWeek[];
  /** Best set ever per exercise, newest first. */
  records: ClientPersonalRecord[];
  /**
   * The longer window as one row per date, every metric that day can speak to.
   *
   * Separate from `kcalByDay` and `dayParts` on purpose: those two answer "what
   * have I been eating lately" over a fortnight, this one is the raw material
   * for comparing two metrics, which needs weeks rather than days to say
   * anything. One fetch covers both — the shorter series are slices of it.
   */
  dayFacts: ClientDayFactRow[];
  /** Day notes in the long window, so an outlier stays explainable. */
  notesByDate: Map<string, string>;
}

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

/**
 * Everything eaten on each day of the window, one array per source.
 *
 * Counts both halves of the day — what was typed into the diary and what was
 * ticked off the plan. Reading only the diary was what made a client who
 * followed their plan perfectly show up here as a flat zero.
 */
type ClientDayAggregate = {
  parts: NutrientValue[][];
  /** Meals of the day that had something in them, planned or logged. */
  mealCount: number;
  waterMl?: number;
  notes?: string;
};

async function loadDayParts(
  clientUserId: string,
  range: { from: string; to: string },
  supabase: SupabaseClient,
): Promise<Map<string, ClientDayAggregate>> {
  const days = await fetchClientFoodLogDays(clientUserId, range, supabase);

  const foodIds = [
    ...new Set(
      days.flatMap((day) =>
        day.entries.map((entry) => entry.foodId).filter((id): id is string => Boolean(id)),
      ),
    ),
  ];

  const foods = await hydrateClientFoods(foodIds, supabase);

  // Recipes logged straight into the diary are priced the same way planned
  // ones are; without this they would count as nothing.
  const recipeFacts = new Map(
    [
      ...(
        await fetchClientRecipeFacts(
          days.flatMap((day) =>
            day.entries.map((entry) => entry.recipeId).filter((id): id is string => Boolean(id)),
          ),
          supabase,
        )
      ).entries(),
    ].map(([id, facts]) => [id, facts.perPortion]),
  );

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

  // Kept as parts rather than summed: the micronutrient trends need to know
  // which sources carried data for what, and re-walking the window a second
  // time to find out would risk the two views describing different days.
  return new Map(
    dates.map((date) => {
      const day = logByDate.get(date);
      const planEntries = planByDate.get(date)?.entries ?? [];

      // Slots rather than items: three entries at breakfast are one meal. A
      // planned meal counts once it was actually answered as eaten.
      const slots = new Set<string>();
      for (const entry of day?.entries ?? []) slots.add(entry.slotType);
      for (const entry of planEntries) {
        if (eatenAmount(entry, completions.get(entry.id)) > 0) slots.add(entry.slotType);
      }

      return [
        date,
        {
          parts: collectClientDayParts({
            entries: day?.entries ?? [],
            foods,
            recipeFacts,
            planEntries,
            completions,
            planFacts,
          }),
          mealCount: slots.size,
          waterMl: day?.waterMl,
          notes: day?.notes,
        },
      ];
    }),
  );
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
  /**
   * How far back to read. The default covers the check-in sections; the
   * fortnight-long series are sliced out of the same rows, so widening this
   * costs one wider query rather than a second one.
   */
  windowDays: number = CLIENT_CHECKIN_WINDOW_DAYS,
): Promise<ClientStats> {
  const client = resolveClient(supabase);
  const range = {
    from: format(subDays(parseISO(today), windowDays - 1), "yyyy-MM-dd"),
    to: today,
  };

  const aggregateByDate = isClientModuleEnabled("tagebuch")
    ? await loadDayParts(clientUserId, range, client)
    : new Map<string, ClientDayAggregate>();

  // Unchanged at a fortnight: this is the "what have I been eating" view, and
  // stretching it to eight weeks would squeeze it into an unreadable smear on
  // a phone.
  const kcalByDay = buildKcalSeries(
    new Map(
      [...aggregateByDate].map(([date, aggregate]) => [
        date,
        getNutrientValue(sumNutrients(aggregate.parts), "energie"),
      ]),
    ),
    range.to,
    CLIENT_STATS_WINDOW_DAYS,
  );

  const averageKcal = averageOfLoggedDays(kcalByDay);

  const dayParts = kcalByDay.map((day) => ({
    date: day.date,
    parts: aggregateByDate.get(day.date)?.parts ?? [],
  }));

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
  let sessionsInWindow: Awaited<ReturnType<typeof fetchClientWorkoutSessions>> = [];
  let burnedByDay: ClientKcalDay[] = [];
  let trainingWeeks: ClientTrainingWeek[] = [];
  let records: ClientPersonalRecord[] = [];
  if (isClientModuleEnabled("training")) {
    // Never narrower than the 60 days the progression and records sections
    // were already reading; a wider check-in window may widen it.
    const sessions = await fetchClientWorkoutSessions(clientUserId, Math.max(60, windowDays), client);
    sessionsInWindow = sessions;
    progress = summarizeExerciseProgress(sessions);
    records = [...findPersonalRecords(sessions).values()].sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    trainingWeeks = summarizeTrainingWeeks(
      sessions.map((session) => ({
        date: session.date,
        durationMinutes: session.durationMinutes,
        volumeKg: session.sets.reduce((sum, set) => sum + setVolumeKg(set), 0),
        kcal:
          estimateActivityEnergy({
            activityId: session.activityKind,
            intensity: session.intensity,
            minutes: session.durationMinutes,
            weightKg: session.bodyWeightKg,
          })?.netKcal ?? 0,
      })),
      today,
    );

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
    burnedByDay = buildKcalSeries(burnedByDate, range.to, CLIENT_STATS_WINDOW_DAYS);
  }

  // Per-day training, for the comparison rather than the weekly summary. A day
  // with no session trained zero minutes; a session nobody timed did not.
  const trainingByDate = new Map<string, { minutes?: number; kcal: number }>();
  if (isClientModuleEnabled("training")) {
    for (const session of sessionsInWindow) {
      const current = trainingByDate.get(session.date) ?? { kcal: 0 };
      if (session.durationMinutes) {
        current.minutes = (current.minutes ?? 0) + session.durationMinutes;
      }
      const energy = estimateActivityEnergy({
        activityId: session.activityKind,
        intensity: session.intensity,
        minutes: session.durationMinutes,
        weightKg: session.bodyWeightKg,
      });
      current.kcal += energy?.netKcal ?? 0;
      trainingByDate.set(session.date, current);
    }
  }

  let checkins: ClientCheckin[] = [];
  if (isClientCapabilityEnabled("befinden")) {
    checkins = await fetchClientCheckins(range, client);
  }
  const checkinByDate = new Map(checkins.map((checkin) => [checkin.date, checkin]));

  const factInputs: ClientDayFactInput[] = [];
  const notesByDate = new Map<string, string>();
  for (let offset = windowDays - 1; offset >= 0; offset--) {
    const date = format(subDays(parseISO(today), offset), "yyyy-MM-dd");
    const aggregate = aggregateByDate.get(date);
    const training = trainingByDate.get(date);

    if (aggregate?.notes) notesByDate.set(date, aggregate.notes);

    factInputs.push({
      date,
      checkin: checkinByDate.get(date),
      parts: aggregate?.parts ?? [],
      mealCount: aggregate?.mealCount,
      waterMl: aggregate?.waterMl,
      hasTraining: isClientModuleEnabled("training") ? training !== undefined : undefined,
      trainingMinutes: training?.minutes,
      trainingKcal: training ? Math.round(training.kcal) : undefined,
    });
  }

  return {
    kcalByDay,
    averageKcal,
    dayParts,
    burnedByDay,
    adherence,
    progress,
    trainingWeeks,
    records,
    dayFacts: buildClientDayFactRows(factInputs),
    notesByDate,
  };
}
