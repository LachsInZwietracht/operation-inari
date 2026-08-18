import { format, parseISO, startOfWeek, subDays, subWeeks } from "date-fns";

/** Two weeks: long enough to show a pattern, short enough to read on a phone. */
export const CLIENT_STATS_WINDOW_DAYS = 14;

/**
 * How far back the check-in sections look.
 *
 * Two weeks is the right window for "what have I been eating"; it is the wrong
 * one for comparing two metrics, where fourteen points is barely more than the
 * floor a comparison is allowed to speak from at all. Eight weeks is also the
 * grain the training section already uses.
 */
export const CLIENT_CHECKIN_WINDOW_DAYS = 56;

/** The windows the check-in sections offer, shortest first. */
export const CLIENT_CHECKIN_WINDOW_OPTIONS = [14, 28, 56] as const;

export interface ClientKcalDay {
  date: string;
  kcal: number;
}

/**
 * A continuous day series for the window, including days with nothing logged.
 *
 * Gaps are filled with zero on purpose: a diary with holes should look like a
 * diary with holes. Dropping empty days would compress the axis and quietly
 * turn four scattered entries into what reads as a solid week.
 */
export function buildKcalSeries(
  kcalByDate: Map<string, number>,
  endDate: string,
  windowDays: number = CLIENT_STATS_WINDOW_DAYS,
): ClientKcalDay[] {
  const end = parseISO(endDate);
  const series: ClientKcalDay[] = [];

  for (let offset = windowDays - 1; offset >= 0; offset--) {
    const date = format(subDays(end, offset), "yyyy-MM-dd");
    series.push({ date, kcal: Math.round(kcalByDate.get(date) ?? 0) });
  }
  return series;
}

/**
 * Average over days that were actually logged, not over the whole window.
 *
 * Including untracked days would divide by fourteen no matter how often
 * someone wrote anything down, so a person who logs carefully twice a week
 * would see an "average" far below what they ate — a number that punishes the
 * gap in the diary rather than describing the food.
 */
export function averageOfLoggedDays(series: ClientKcalDay[]): number {
  const logged = series.filter((day) => day.kcal > 0);
  if (logged.length === 0) return 0;
  return Math.round(logged.reduce((sum, day) => sum + day.kcal, 0) / logged.length);
}

/** How much training happened in one calendar week. */
export interface ClientTrainingWeek {
  weekStart: string; // ISO date of the Monday
  sessions: number;
  minutes: number;
  /** Net energy, only from sessions that carry a duration and a body weight. */
  kcal: number;
  /** Tonnage across every exercise: Σ reps × kg. */
  volumeKg: number;
}

/** How many weeks the training section looks back. */
export const CLIENT_TRAINING_WEEKS = 8;

/**
 * Training by week rather than by day.
 *
 * A day is the wrong grain here: nobody trains daily, so a daily series is
 * mostly zeros and reads as failure. A week is the unit people actually plan
 * in — "dreimal die Woche" — and it is the unit progress shows up in.
 */
export function summarizeTrainingWeeks(
  sessions: {
    date: string;
    durationMinutes?: number;
    volumeKg: number;
    kcal: number;
  }[],
  endDate: string,
  weeks: number = CLIENT_TRAINING_WEEKS,
): ClientTrainingWeek[] {
  const byWeek = new Map<string, ClientTrainingWeek>();

  const end = startOfWeek(parseISO(endDate), { weekStartsOn: 1 });
  for (let offset = weeks - 1; offset >= 0; offset--) {
    const weekStart = format(subWeeks(end, offset), "yyyy-MM-dd");
    byWeek.set(weekStart, { weekStart, sessions: 0, minutes: 0, kcal: 0, volumeKg: 0 });
  }

  for (const session of sessions) {
    const weekStart = format(startOfWeek(parseISO(session.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const week = byWeek.get(weekStart);
    // Outside the window: dropped rather than folded into the nearest week.
    if (!week) continue;

    week.sessions += 1;
    week.minutes += session.durationMinutes ?? 0;
    week.kcal += session.kcal;
    week.volumeKg += session.volumeKg;
  }

  return [...byWeek.values()].map((week) => ({
    ...week,
    volumeKg: Math.round(week.volumeKg),
    kcal: Math.round(week.kcal),
  }));
}
