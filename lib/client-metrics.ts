/**
 * Every number a client day can be described by, declared once.
 *
 * This registry is the spine of the check-in and of the evaluation built on
 * top of it. The check-in card reads it to know which fields to render, the
 * settings screen to know which switches to offer, and the Zusammenhänge view
 * to know how to bucket a metric and which stretch of time it describes.
 * Adding a metric is an entry here plus, if it is self-reported, one column.
 *
 * Same discipline as `lib/client-modules.ts`: the description lives in one
 * place, and nothing infers a metric's behaviour from its key.
 */

export type ClientMetricKey =
  | "energy"
  | "mood"
  | "digestion"
  | "sleep_minutes"
  | "sleep_quality"
  | "alcohol_units"
  | "water_ml"
  | "kcal"
  | "protein_g"
  | "fat_g"
  | "carbs_g"
  | "sugar_g"
  | "fiber_g"
  | "meal_count"
  | "training_day"
  | "training_minutes"
  | "training_kcal"
  | "weight_kg";

export type ClientMetricGroup = "befinden" | "ernaehrung" | "training" | "koerper";

export const CLIENT_METRIC_GROUP_LABELS: Record<ClientMetricGroup, string> = {
  befinden: "Befinden",
  ernaehrung: "Ernährung",
  training: "Aktivität",
  koerper: "Körper",
};

export type ClientMetricSource = "checkin" | "foodlog" | "workout" | "anthropometrics";

/**
 * Which stretch of time a value describes.
 *
 * The whole reason this field exists: sleep entered on Tuesday happened in the
 * night onto Tuesday, while the food, the training and the day's own scores
 * belong to Tuesday itself. A comparison that ignores this mixes "how I slept
 * after eating that" with "how I ate after sleeping badly" and reads as noise.
 */
export type ClientMetricWindow = "day" | "night-before";

/**
 * How a metric's values are grouped for the bucket comparison.
 *
 * `fixed` and `ordinal` carry meaning that holds for everyone; `quartile` is
 * computed from this person's own window, because a fixed kcal edge would be
 * wrong for almost every individual. `null` means the metric is chartable but
 * not bucketable — see `weight_kg`.
 */
export type ClientBucketRule =
  | { kind: "fixed"; edges: number[]; labels: string[] }
  | { kind: "ordinal"; groups: { label: string; min: number; max: number }[] }
  | { kind: "quartile"; positiveOnly?: boolean }
  | { kind: "binary"; falseLabel: string; trueLabel: string };

export type ClientMetricDefaults = {
  /**
   * Recorded and displayed. One flag, not two: a field someone fills in every
   * evening and then never looks at is a field they would rather not have, and
   * splitting the two only ever produced the combination nobody wants.
   */
  visible: boolean;
  shared: boolean;
};

export type ClientMetric = {
  key: ClientMetricKey;
  label: string;
  /** Used where the full label does not fit — chart axes, table headers. */
  shortLabel?: string;
  group: ClientMetricGroup;
  unit?: string;
  source: ClientMetricSource;
  scale: { min: number; max: number } | "continuous";
  window: ClientMetricWindow;
  buckets: ClientBucketRule | null;
  decimals: number;
  /**
   * Answered by hand in the check-in. Switching a derived metric off only
   * hides it — the number keeps being computed from data entered elsewhere.
   */
  selfReported: boolean;
  defaults: ClientMetricDefaults;
};

const ORDINAL_FIVE: ClientBucketRule = {
  kind: "ordinal",
  groups: [
    { label: "1–2", min: 1, max: 2 },
    { label: "3", min: 3, max: 3 },
    { label: "4–5", min: 4, max: 5 },
  ],
};

export const CLIENT_METRICS: ClientMetric[] = [
  {
    key: "energy",
    label: "Energie",
    group: "befinden",
    source: "checkin",
    scale: { min: 1, max: 5 },
    window: "day",
    buckets: ORDINAL_FIVE,
    decimals: 0,
    selfReported: true,
    defaults: { visible: true, shared: true },
  },
  {
    key: "mood",
    label: "Stimmung",
    group: "befinden",
    source: "checkin",
    scale: { min: 1, max: 5 },
    window: "day",
    buckets: ORDINAL_FIVE,
    decimals: 0,
    selfReported: true,
    defaults: { visible: true, shared: true },
  },
  {
    key: "digestion",
    label: "Verdauung",
    group: "befinden",
    source: "checkin",
    scale: { min: 1, max: 5 },
    window: "day",
    buckets: ORDINAL_FIVE,
    decimals: 0,
    selfReported: true,
    defaults: { visible: true, shared: true },
  },
  {
    key: "sleep_minutes",
    label: "Schlafdauer",
    shortLabel: "Schlaf",
    group: "befinden",
    unit: "h",
    source: "checkin",
    scale: "continuous",
    window: "night-before",
    buckets: {
      kind: "fixed",
      edges: [360, 420, 480],
      labels: ["< 6 h", "6–7 h", "7–8 h", "> 8 h"],
    },
    decimals: 0,
    selfReported: true,
    defaults: { visible: true, shared: true },
  },
  {
    key: "sleep_quality",
    label: "Schlafqualität",
    group: "befinden",
    source: "checkin",
    scale: { min: 1, max: 5 },
    window: "night-before",
    buckets: ORDINAL_FIVE,
    decimals: 0,
    selfReported: true,
    defaults: { visible: false, shared: true },
  },
  {
    key: "alcohol_units",
    label: "Alkohol",
    group: "befinden",
    unit: "Gläser",
    source: "checkin",
    scale: "continuous",
    window: "day",
    buckets: {
      kind: "fixed",
      edges: [0.5, 1.5, 2.5],
      labels: ["0", "0,5–1", "1,5–2", "> 2"],
    },
    decimals: 1,
    selfReported: true,
    defaults: { visible: false, shared: true },
  },
  {
    key: "water_ml",
    label: "Wasser",
    group: "ernaehrung",
    unit: "ml",
    // Lives in `client_food_log_days` since the day-context work; the assembler
    // is what hides that split from everything above it.
    source: "foodlog",
    scale: "continuous",
    window: "day",
    buckets: {
      kind: "fixed",
      edges: [1000, 2000],
      labels: ["< 1 l", "1–2 l", "> 2 l"],
    },
    decimals: 0,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
  {
    key: "kcal",
    label: "Energie (Essen)",
    shortLabel: "kcal",
    group: "ernaehrung",
    unit: "kcal",
    source: "foodlog",
    scale: "continuous",
    window: "day",
    buckets: { kind: "quartile" },
    decimals: 0,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
  {
    key: "protein_g",
    label: "Protein",
    group: "ernaehrung",
    unit: "g",
    source: "foodlog",
    scale: "continuous",
    window: "day",
    buckets: { kind: "quartile" },
    decimals: 0,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
  {
    key: "fat_g",
    label: "Fett",
    group: "ernaehrung",
    unit: "g",
    source: "foodlog",
    scale: "continuous",
    window: "day",
    buckets: { kind: "quartile" },
    decimals: 0,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
  {
    key: "carbs_g",
    label: "Kohlenhydrate",
    shortLabel: "KH",
    group: "ernaehrung",
    unit: "g",
    source: "foodlog",
    scale: "continuous",
    window: "day",
    buckets: { kind: "quartile" },
    decimals: 0,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
  {
    key: "sugar_g",
    label: "Zucker",
    group: "ernaehrung",
    unit: "g",
    source: "foodlog",
    scale: "continuous",
    window: "day",
    buckets: { kind: "quartile" },
    decimals: 0,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
  {
    key: "fiber_g",
    label: "Ballaststoffe",
    group: "ernaehrung",
    unit: "g",
    source: "foodlog",
    scale: "continuous",
    window: "day",
    buckets: { kind: "quartile" },
    decimals: 0,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
  {
    key: "meal_count",
    label: "Mahlzeiten",
    group: "ernaehrung",
    source: "foodlog",
    scale: "continuous",
    window: "day",
    buckets: {
      kind: "fixed",
      edges: [3, 4, 5],
      labels: ["1–2", "3", "4", "5+"],
    },
    decimals: 0,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
  {
    key: "training_day",
    label: "Trainingstag",
    group: "training",
    source: "workout",
    scale: { min: 0, max: 1 },
    window: "day",
    buckets: { kind: "binary", falseLabel: "ohne Training", trueLabel: "mit Training" },
    decimals: 0,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
  {
    key: "training_minutes",
    label: "Trainingsdauer",
    group: "training",
    unit: "min",
    source: "workout",
    scale: "continuous",
    window: "day",
    // Over training days only: quartiles across a window full of rest-day
    // zeros would put three of four boundaries at zero.
    buckets: { kind: "quartile", positiveOnly: true },
    decimals: 0,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
  {
    key: "training_kcal",
    label: "Trainingsenergie",
    group: "training",
    unit: "kcal",
    source: "workout",
    scale: "continuous",
    window: "day",
    buckets: { kind: "quartile", positiveOnly: true },
    decimals: 0,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
  {
    key: "weight_kg",
    label: "Gewicht",
    group: "koerper",
    unit: "kg",
    source: "anthropometrics",
    scale: "continuous",
    window: "day",
    // Chartable, deliberately not bucketable: weight is a level that moves
    // over weeks, so "on days you weighed 82 kg" is not a group of comparable
    // days, it is a stretch of calendar.
    buckets: null,
    decimals: 1,
    selfReported: false,
    defaults: { visible: true, shared: true },
  },
];

const BY_KEY = new Map(CLIENT_METRICS.map((metric) => [metric.key, metric]));

export function getClientMetric(key: ClientMetricKey): ClientMetric {
  const metric = BY_KEY.get(key);
  if (!metric) throw new Error(`Unknown client metric: ${key}`);
  return metric;
}

export function isClientMetricKey(key: string): key is ClientMetricKey {
  return BY_KEY.has(key as ClientMetricKey);
}

/** The check-in's own metrics, in the order the card renders them. */
export const CHECKIN_METRICS = CLIENT_METRICS.filter((metric) => metric.selfReported);

export type ClientMetricPreference = ClientMetricDefaults;

export type ClientMetricPreferences = Map<ClientMetricKey, ClientMetricPreference>;

/**
 * Stored rows over registry defaults.
 *
 * A missing row is the default, which is what keeps the table proportional to
 * the decisions a person actually made.
 *
 * The row still carries the two columns `tracked` and `shown` from when they
 * were separate switches. They are written together now, and a stored row that
 * still has them apart is read as off — the older pair only ever diverged when
 * someone switched one of the two off, and that was always meant as "away".
 */
export function resolveClientMetricPreferences(
  rows: { metricKey: string; tracked: boolean; shown: boolean; shared: boolean }[],
): ClientMetricPreferences {
  const stored = new Map(rows.filter((row) => isClientMetricKey(row.metricKey)).map((row) => [row.metricKey, row]));

  return new Map(
    CLIENT_METRICS.map((metric) => {
      const row = stored.get(metric.key);
      return [
        metric.key,
        {
          visible: row ? row.tracked && row.shown : metric.defaults.visible,
          shared: row?.shared ?? metric.defaults.shared,
        },
      ];
    }),
  );
}

export function clientMetricPreference(
  preferences: ClientMetricPreferences,
  key: ClientMetricKey,
): ClientMetricPreference {
  return preferences.get(key) ?? getClientMetric(key).defaults;
}

/** Which fields the check-in card renders, in registry order. */
export function visibleCheckinMetrics(preferences: ClientMetricPreferences): ClientMetric[] {
  return CHECKIN_METRICS.filter((metric) => clientMetricPreference(preferences, metric.key).visible);
}

/** Which metrics the Verlauf and the pair picker offer, in registry order. */
export function shownClientMetrics(preferences: ClientMetricPreferences): ClientMetric[] {
  return CLIENT_METRICS.filter((metric) => clientMetricPreference(preferences, metric.key).visible);
}

/** Minutes as people say them: 7:15, not 435 and not 7,25. */
export function formatSleepDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return `${hours}:${String(rest).padStart(2, "0")} h`;
}

/** One value in this metric's own notation, unit included. */
export function formatMetricValue(metric: ClientMetric, value: number): string {
  if (metric.key === "sleep_minutes") return formatSleepDuration(value);
  if (metric.key === "training_day") return value >= 0.5 ? "ja" : "nein";

  const formatted = value.toFixed(metric.decimals).replace(".", ",");
  return metric.unit ? `${formatted} ${metric.unit}` : formatted;
}

/** The axis label: what the number is, and in what unit. */
export function metricAxisLabel(metric: ClientMetric): string {
  const label = metric.shortLabel ?? metric.label;
  if (metric.key === "sleep_minutes") return `${label} (h)`;
  return metric.unit ? `${label} (${metric.unit})` : label;
}

/** Sleep is stored in minutes and read in hours; every chart wants the hours. */
export function metricChartValue(metric: ClientMetric, value: number): number {
  return metric.key === "sleep_minutes" ? Math.round((value / 60) * 100) / 100 : value;
}
