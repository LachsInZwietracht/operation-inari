import { format, parseISO, startOfWeek } from "date-fns";

import type {
  ClientExerciseProgress,
  ClientExerciseProgressPoint,
  ClientWorkoutSession,
} from "@/lib/types";

/**
 * Progression is derived, never stored: best set per exercise per calendar
 * week, recomputed from the sets themselves. A stored aggregate would only be
 * one more thing to keep in sync when a set is corrected.
 *
 * "Best" is the heaviest set, with reps as the tie-breaker — the common way to
 * read a strength log. Bodyweight exercises carry no weight, so they fall back
 * to most reps.
 */
export function summarizeExerciseProgress(
  sessions: ClientWorkoutSession[],
): ClientExerciseProgress[] {
  // Exercise names are free text, so group case-insensitively but display the
  // spelling the person used most recently.
  const byExercise = new Map<
    string,
    { label: string; weeks: Map<string, ClientExerciseProgressPoint> }
  >();

  const chronological = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  for (const session of chronological) {
    const weekStart = format(startOfWeek(parseISO(session.date), { weekStartsOn: 1 }), "yyyy-MM-dd");

    for (const set of session.sets) {
      const key = set.exerciseName.trim().toLowerCase();
      if (!key) continue;

      const exercise = byExercise.get(key) ?? { label: set.exerciseName.trim(), weeks: new Map() };
      exercise.label = set.exerciseName.trim();

      const point = exercise.weeks.get(weekStart) ?? { weekStart, totalSets: 0 };
      point.totalSets += 1;

      const isHeavier =
        set.weightKg !== undefined &&
        (point.bestWeightKg === undefined || set.weightKg > point.bestWeightKg);
      const isSameWeightMoreReps =
        set.weightKg !== undefined &&
        point.bestWeightKg !== undefined &&
        set.weightKg === point.bestWeightKg &&
        (set.reps ?? 0) > (point.bestReps ?? 0);

      if (isHeavier || isSameWeightMoreReps) {
        point.bestWeightKg = set.weightKg;
        point.bestReps = set.reps;
      } else if (point.bestWeightKg === undefined && (set.reps ?? 0) > (point.bestReps ?? 0)) {
        point.bestReps = set.reps;
      }

      exercise.weeks.set(weekStart, point);
      byExercise.set(key, exercise);
    }
  }

  return [...byExercise.values()]
    .map((exercise) => ({
      exerciseName: exercise.label,
      points: [...exercise.weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, "de"));
}

/** Exercise names already used, newest first — feeds the input's suggestions. */
export function collectExerciseNames(sessions: ClientWorkoutSession[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const session of [...sessions].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const set of session.sets) {
      const name = set.exerciseName.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }

  return names;
}

/** Formats a set the way a training log reads: 8 × 40 kg. */
export function formatSet(reps?: number, weightKg?: number): string {
  if (reps !== undefined && weightKg !== undefined) return `${reps} × ${weightKg} kg`;
  if (reps !== undefined) return `${reps} Wdh.`;
  if (weightKg !== undefined) return `${weightKg} kg`;
  return "—";
}
