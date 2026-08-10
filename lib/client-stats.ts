import { format, parseISO, subDays } from "date-fns";

/** Two weeks: long enough to show a pattern, short enough to read on a phone. */
export const CLIENT_STATS_WINDOW_DAYS = 14;

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
