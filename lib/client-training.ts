import { format, parseISO, startOfWeek } from "date-fns";

import type {
  ClientExerciseHistoryEntry,
  ClientExerciseProgress,
  ClientExerciseProgressPoint,
  ClientPersonalRecord,
  ClientWorkoutSession,
  ClientWorkoutSet,
} from "@/lib/types";

/** Exercise names are free text, so everything groups on this. */
function exerciseKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Estimated one-rep max, Epley: w × (1 + reps/30).
 *
 * This is what makes two sets comparable. 8 × 60 kg (76 kg) and 5 × 70 kg
 * (82 kg) are indistinguishable to a "heaviest set" rule, and adding reps at
 * the same weight reads as no progress at all — both are progress, and e1RM
 * says so.
 *
 * It is an estimate built from low-rep strength work and drifts optimistic
 * above roughly 12 reps; it stays useful there as a *trend* against itself,
 * which is how the charts use it. Bodyweight sets carry no weight and so have
 * no e1RM.
 */
export function estimateOneRepMax(reps?: number, weightKg?: number): number | undefined {
  if (weightKg === undefined || weightKg <= 0) return undefined;
  if (reps === undefined || reps <= 1) return round1(weightKg);
  return round1(weightKg * (1 + reps / 30));
}

/** Tonnage of a single set. Bodyweight sets contribute nothing to it. */
export function setVolumeKg(set: Pick<ClientWorkoutSet, "reps" | "weightKg">): number {
  if (set.reps === undefined || set.weightKg === undefined) return 0;
  return set.reps * set.weightKg;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Progression is derived, never stored: the week's best set per exercise,
 * recomputed from the sets themselves. A stored aggregate would only be one
 * more thing to keep in sync when a set is corrected.
 *
 * Three measures per week, because they answer different questions:
 *   bestWeightKg      — what the person would call their top set
 *   bestOneRepMaxKg   — did I get stronger (reps and weight on one axis)
 *   volumeKg          — did I do more work (the 3×10 → 4×10 case)
 */
export function summarizeExerciseProgress(
  sessions: ClientWorkoutSession[],
): ClientExerciseProgress[] {
  // Display the spelling the person used most recently.
  const byExercise = new Map<
    string,
    { label: string; weeks: Map<string, ClientExerciseProgressPoint> }
  >();

  const chronological = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  for (const session of chronological) {
    const weekStart = format(startOfWeek(parseISO(session.date), { weekStartsOn: 1 }), "yyyy-MM-dd");

    for (const set of session.sets) {
      const key = exerciseKey(set.exerciseName);
      if (!key) continue;

      const exercise = byExercise.get(key) ?? { label: set.exerciseName.trim(), weeks: new Map() };
      exercise.label = set.exerciseName.trim();

      const point = exercise.weeks.get(weekStart) ?? { weekStart, totalSets: 0, volumeKg: 0 };
      point.totalSets += 1;
      point.volumeKg = round1(point.volumeKg + setVolumeKg(set));

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

      // Tracked independently of the top set: the heaviest set is not always
      // the strongest one.
      const oneRepMax = estimateOneRepMax(set.reps, set.weightKg);
      if (oneRepMax !== undefined && (point.bestOneRepMaxKg ?? 0) < oneRepMax) {
        point.bestOneRepMaxKg = oneRepMax;
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

/**
 * The best set ever recorded per exercise, keyed by lowercased exercise name.
 *
 * Ranked by e1RM so that more reps at the same weight counts as a record. Ties
 * keep the *earlier* set: a record is the moment it was first reached, and
 * repeating it should not silently move the badge to today.
 */
export function findPersonalRecords(
  sessions: ClientWorkoutSession[],
): Map<string, ClientPersonalRecord> {
  const records = new Map<string, ClientPersonalRecord>();
  const chronological = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  for (const session of chronological) {
    for (const set of session.sets) {
      const key = exerciseKey(set.exerciseName);
      const oneRepMax = estimateOneRepMax(set.reps, set.weightKg);
      if (!key || oneRepMax === undefined) continue;

      const current = records.get(key);
      if (!current || oneRepMax > current.oneRepMaxKg) {
        records.set(key, {
          exerciseName: set.exerciseName.trim(),
          oneRepMaxKg: oneRepMax,
          reps: set.reps,
          weightKg: set.weightKg,
          setId: set.id,
          date: session.date,
        });
      }
    }
  }

  return records;
}

/** Every set of one exercise, newest session first — the detail view's source. */
export function buildExerciseHistory(
  sessions: ClientWorkoutSession[],
  exerciseName: string,
): ClientExerciseHistoryEntry[] {
  const key = exerciseKey(exerciseName);
  if (!key) return [];

  return [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((session) => ({
      sessionId: session.id,
      date: session.date,
      title: session.title,
      sets: session.sets.filter((set) => exerciseKey(set.exerciseName) === key),
    }))
    .filter((entry) => entry.sets.length > 0);
}

/**
 * The last time this exercise was trained, ignoring the session being written.
 *
 * Returns every set of it, not just one: the useful comparison in the gym is
 * the whole run — "3 × 8 × 60" — not the single heaviest rep.
 */
export function findLastPerformance(
  sessions: ClientWorkoutSession[],
  exerciseName: string,
  excludeSessionId?: string,
): { date: string; sets: ClientWorkoutSet[] } | null {
  const key = exerciseKey(exerciseName);
  if (!key) return null;

  for (const past of [...sessions].sort((a, b) => b.date.localeCompare(a.date))) {
    if (past.id === excludeSessionId) continue;
    const sets = past.sets.filter((set) => exerciseKey(set.exerciseName) === key);
    if (sets.length > 0) return { date: past.date, sets };
  }
  return null;
}

/**
 * Exercises to offer as one-tap chips on an open session.
 *
 * Taken from the most recent earlier session with the same title, which is how
 * people already name a repeated workout ("Oberkörper A"). Nothing is stored
 * for this — it is read back out of the log — so it works retroactively and
 * costs no schema. Exercises already logged today drop out.
 */
export function suggestExercisesForSession(
  sessions: ClientWorkoutSession[],
  session: ClientWorkoutSession,
): string[] {
  const title = session.title.trim().toLowerCase();
  if (!title) return [];

  const done = new Set(session.sets.map((set) => exerciseKey(set.exerciseName)));

  const source = [...sessions]
    .filter((candidate) => candidate.id !== session.id && candidate.title.trim().toLowerCase() === title)
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((candidate) => candidate.sets.length > 0);
  if (!source) return [];

  const suggestions: string[] = [];
  const seen = new Set<string>();
  for (const set of source.sets) {
    const key = exerciseKey(set.exerciseName);
    if (!key || done.has(key) || seen.has(key)) continue;
    seen.add(key);
    suggestions.push(set.exerciseName.trim());
  }
  return suggestions;
}

/** Exercise names already used, newest first — feeds the input's suggestions. */
export function collectExerciseNames(sessions: ClientWorkoutSession[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const session of [...sessions].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const set of session.sets) {
      const name = set.exerciseName.trim();
      const key = exerciseKey(name);
      if (!name || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }

  return names;
}

/** Next set number for an exercise within one session. */
export function nextSetIndex(session: ClientWorkoutSession, exerciseName: string): number {
  const key = exerciseKey(exerciseName);
  return session.sets.filter((set) => exerciseKey(set.exerciseName) === key).length + 1;
}

/** Formats a set the way a training log reads: 8 × 40 kg. */
export function formatSet(reps?: number, weightKg?: number): string {
  if (reps !== undefined && weightKg !== undefined) return `${reps} × ${weightKg} kg`;
  if (reps !== undefined) return `${reps} Wdh.`;
  if (weightKg !== undefined) return `${weightKg} kg`;
  return "—";
}

/** Condenses repeated sets: "3 × 8 × 60 kg" instead of the same line three times. */
export function formatSetRun(sets: Pick<ClientWorkoutSet, "reps" | "weightKg">[]): string {
  if (sets.length === 0) return "—";

  const parts: string[] = [];
  let runLength = 0;
  let runLabel = "";

  for (const set of sets) {
    const label = formatSet(set.reps, set.weightKg);
    if (label === runLabel) {
      runLength += 1;
      continue;
    }
    if (runLabel) parts.push(runLength > 1 ? `${runLength} × ${runLabel}` : runLabel);
    runLabel = label;
    runLength = 1;
  }
  parts.push(runLength > 1 ? `${runLength} × ${runLabel}` : runLabel);

  return parts.join(", ");
}
