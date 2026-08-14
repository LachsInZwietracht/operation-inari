import { expect, test } from "@playwright/test";

import {
  addWeeks,
  buildExerciseHistory,
  estimateOneRepMax,
  findLastPerformance,
  findPersonalRecords,
  formatSetRun,
  isStrengthKind,
  isStrengthSession,
  nextSetIndex,
  suggestExercisesForSession,
  summarizeExerciseProgress,
  summarizeWeek,
  weekEnd,
  weekStart,
} from "@/lib/client-training";
import type { ClientWorkoutSession, ClientWorkoutSet } from "@/lib/types";

/**
 * The derived side of the training module. None of this touches the database:
 * progression, records and the logging shortcuts are all recomputed from the
 * sets, so they are exactly the kind of thing that should be pinned by a test
 * rather than checked by eye in the app.
 */

let nextId = 0;

function set(exerciseName: string, reps?: number, weightKg?: number): ClientWorkoutSet {
  nextId += 1;
  return {
    id: `set-${nextId}`,
    sessionId: "session",
    exerciseName,
    setIndex: 1,
    reps,
    weightKg,
  };
}

function session(
  id: string,
  date: string,
  title: string,
  sets: ClientWorkoutSet[],
): ClientWorkoutSession {
  return { id, date, title, sets: sets.map((s, index) => ({ ...s, sessionId: id, setIndex: index + 1 })) };
}

test.describe("estimated one-rep max", () => {
  test("makes reps and weight comparable on one number", () => {
    // The case the old "heaviest set" rule got wrong: the lighter set is the
    // stronger one.
    expect(estimateOneRepMax(8, 60)).toBe(76);
    expect(estimateOneRepMax(5, 70)).toBeGreaterThan(estimateOneRepMax(8, 60)!);
  });

  test("a single rep is its own maximum", () => {
    expect(estimateOneRepMax(1, 100)).toBe(100);
  });

  test("bodyweight work has none", () => {
    expect(estimateOneRepMax(12, undefined)).toBeUndefined();
    expect(estimateOneRepMax(12, 0)).toBeUndefined();
  });
});

test.describe("weekly progression", () => {
  const sessions = [
    session("s1", "2026-07-06", "Beine", [set("Kniebeuge", 10, 50), set("Kniebeuge", 10, 50)]),
    session("s2", "2026-07-13", "Beine", [
      set("Kniebeuge", 10, 50),
      set("Kniebeuge", 10, 50),
      set("Kniebeuge", 10, 50),
    ]),
  ];

  test("volume catches the extra set that weight alone misses", () => {
    const [exercise] = summarizeExerciseProgress(sessions);

    expect(exercise.points.map((point) => point.bestWeightKg)).toEqual([50, 50]);
    // Same top set both weeks — but a third of the work again.
    expect(exercise.points.map((point) => point.volumeKg)).toEqual([1000, 1500]);
    expect(exercise.points.map((point) => point.totalSets)).toEqual([2, 3]);
  });

  test("bodyweight sets count as sets but not as tonnage", () => {
    const [exercise] = summarizeExerciseProgress([
      session("s1", "2026-07-06", "Rumpf", [set("Klimmzug", 8), set("Klimmzug", 6)]),
    ]);

    expect(exercise.points[0].totalSets).toBe(2);
    expect(exercise.points[0].volumeKg).toBe(0);
    expect(exercise.points[0].bestOneRepMaxKg).toBeUndefined();
    expect(exercise.points[0].bestReps).toBe(8);
  });

  test("the week's best 1RM is not always its heaviest set", () => {
    const [exercise] = summarizeExerciseProgress([
      session("s1", "2026-07-06", "Druck", [set("Bankdrücken", 10, 60), set("Bankdrücken", 1, 75)]),
    ]);

    expect(exercise.points[0].bestWeightKg).toBe(75);
    expect(exercise.points[0].bestOneRepMaxKg).toBe(80); // 60 × (1 + 10/30)
  });
});

test.describe("personal records", () => {
  test("ranks by 1RM, so more reps at the same weight is a record", () => {
    const sessions = [
      session("s1", "2026-07-06", "Druck", [set("Bankdrücken", 8, 60)]),
      session("s2", "2026-07-13", "Druck", [set("Bankdrücken", 10, 60)]),
    ];

    const record = findPersonalRecords(sessions).get("bankdrücken");
    expect(record?.date).toBe("2026-07-13");
    expect(record?.reps).toBe(10);
  });

  test("repeating a record does not move it to today", () => {
    const sessions = [
      session("s1", "2026-07-06", "Druck", [set("Bankdrücken", 8, 60)]),
      session("s2", "2026-07-13", "Druck", [set("Bankdrücken", 8, 60)]),
    ];

    expect(findPersonalRecords(sessions).get("bankdrücken")?.date).toBe("2026-07-06");
  });
});

test.describe("logging shortcuts", () => {
  const sessions = [
    session("s1", "2026-07-06", "Oberkörper A", [
      set("Bankdrücken", 8, 60),
      set("Bankdrücken", 8, 60),
      set("Rudern", 10, 40),
    ]),
    session("s2", "2026-07-13", "Oberkörper A", [set("Bankdrücken", 8, 62.5)]),
  ];

  test("the last performance is the whole run, not one set", () => {
    const last = findLastPerformance(sessions, "Bankdrücken", "s2");
    expect(last?.date).toBe("2026-07-06");
    expect(last?.sets).toHaveLength(2);
  });

  test("the session being written is excluded from its own comparison", () => {
    // Without the exclusion the dialog would compare today against today.
    expect(findLastPerformance(sessions, "Rudern", "s1")).toBeNull();
  });

  test("suggestions come from the last session of the same name, minus what is done", () => {
    const current = sessions[1];
    expect(suggestExercisesForSession(sessions, current)).toEqual(["Rudern"]);
  });

  test("a session with a new title has nothing to suggest", () => {
    const fresh = session("s3", "2026-07-20", "Beine", []);
    expect(suggestExercisesForSession([...sessions, fresh], fresh)).toEqual([]);
  });

  test("set numbering is per exercise, case-insensitively", () => {
    expect(nextSetIndex(sessions[0], "bankdrücken")).toBe(3);
    expect(nextSetIndex(sessions[0], "Kniebeuge")).toBe(1);
  });

  test("history keeps only the sessions that contain the exercise", () => {
    const history = buildExerciseHistory(sessions, "Rudern");
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe("2026-07-06");
  });
});

test.describe("set formatting", () => {
  test("collapses repeats and keeps the order of the changes", () => {
    expect(
      formatSetRun([
        { reps: 8, weightKg: 60 },
        { reps: 8, weightKg: 60 },
        { reps: 6, weightKg: 60 },
      ]),
    ).toBe("2 × 8 × 60 kg, 6 × 60 kg");
  });

  test("a single set is written plainly", () => {
    expect(formatSetRun([{ reps: 10, weightKg: 40 }])).toBe("10 × 40 kg");
  });
});

/**
 * Activity by week.
 *
 * The tab covers walks and bike rides now, not only lifting — which is why the
 * two questions here are "which week is this" and "does this session want the
 * exercise machinery at all".
 */
test.describe("the week as the unit", () => {
  test("a week runs Monday to Sunday", () => {
    // 2026-08-14 is a Friday.
    expect(weekStart("2026-08-14")).toBe("2026-08-10");
    expect(weekEnd("2026-08-10")).toBe("2026-08-16");
    // Sunday belongs to the week that started six days earlier, not the next.
    expect(weekStart("2026-08-16")).toBe("2026-08-10");
    expect(weekStart("2026-08-17")).toBe("2026-08-17");
  });

  test("paging moves whole weeks in both directions", () => {
    expect(addWeeks("2026-08-10", -1)).toBe("2026-08-03");
    expect(addWeeks("2026-08-10", 1)).toBe("2026-08-17");
  });

  test("a week with nothing costed reports no energy rather than zero", () => {
    // Sessions logged without a duration have not burned nothing — they have
    // simply not said, and a confident 0 would read as the former.
    const summary = summarizeWeek([{ sets: [], durationMinutes: undefined }]);
    expect(summary.sessions).toBe(1);
    expect(summary.kcal).toBeUndefined();
  });

  test("minutes and volume add up across the week", () => {
    const summary = summarizeWeek([
      { durationMinutes: 30, sets: [], kcal: 120 },
      { durationMinutes: 70, sets: [{ reps: 10, weightKg: 40 } as never], kcal: 200 },
    ]);
    expect(summary.minutes).toBe(100);
    expect(summary.volumeKg).toBe(400);
    expect(summary.kcal).toBe(320);
  });
});

test.describe("what wants sets and what does not", () => {
  test("a walk is a complete entry with nothing in it", () => {
    expect(isStrengthSession({ activityKind: "gehen", sets: [] })).toBe(false);
    expect(isStrengthSession({ activityKind: "radfahren", sets: [] })).toBe(false);
  });

  test("strength work keeps the exercise machinery", () => {
    expect(isStrengthSession({ activityKind: "kraft", sets: [] })).toBe(true);
    expect(isStrengthSession({ activityKind: "zirkel", sets: [] })).toBe(true);
  });

  test("only strength kinds may skip the duration", () => {
    // The entry form has to decide before any set exists, so this is the one
    // definition both it and the card read.
    expect(isStrengthKind("kraft")).toBe(true);
    expect(isStrengthKind("zirkel")).toBe(true);
    expect(isStrengthKind("gehen")).toBe(false);
    expect(isStrengthKind("sonstiges")).toBe(false);
    expect(isStrengthKind(undefined)).toBe(false);
  });

  test("a session from before the column existed keeps its sets", () => {
    // Hiding the exercise machinery from rows written when this tab *was*
    // strength training would be a change made to someone's past.
    expect(isStrengthSession({ sets: [] })).toBe(true);
  });

  test("anything that already has sets is a workout, whatever it was called", () => {
    // Someone logs a walk, then adds a set of pull-ups from the playground bar.
    expect(isStrengthSession({ activityKind: "gehen", sets: [{} as never] })).toBe(true);
  });
});
