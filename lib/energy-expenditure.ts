/**
 * Energy expenditure of physical activity, from METs.
 *
 * One MET is resting metabolism, defined as 3.5 ml O₂ per kg per minute, which
 * works out to roughly 1 kcal per kg per hour. An activity rated at 6 MET
 * therefore costs 6 × 3.5 × kg / 200 kcal per minute. The MET values below are
 * the Compendium of Physical Activities (Ainsworth et al., 2011), read at three
 * effort levels rather than a single number per sport.
 *
 * Two decisions worth knowing about, both about not overstating the number:
 *
 * 1. The headline figure is **net** — (MET − 1) — not gross. Gross includes the
 *    resting metabolism the body would have spent lying on the sofa, about
 *    80 kcal an hour for an 80 kg person. In a nutrition app that difference is
 *    not academic: it is what gets eaten back.
 *
 * 2. Every result carries a range. Resistance training in particular depends on
 *    rest intervals nobody logs, so its true cost scatters by roughly a third
 *    around any estimate. A single confident number would be a lie told to one
 *    decimal place.
 *
 * The activity key is a plain string on the row, not an enum in the database —
 * same reasoning as the exercise names in the training module. An unknown key
 * falls back to `sonstiges` instead of failing.
 */

export type ActivityIntensity = "leicht" | "moderat" | "intensiv";

export const ACTIVITY_INTENSITIES: ActivityIntensity[] = ["leicht", "moderat", "intensiv"];

export interface MetActivity {
  id: string;
  label: string;
  met: Record<ActivityIntensity, number>;
  /** Fractional spread of the estimate, ± around the point value. */
  uncertainty: number;
  /** Lowercase words that map free-text activity names onto this entry. */
  keywords: string[];
}

export const MET_ACTIVITIES: MetActivity[] = [
  {
    id: "kraft",
    label: "Krafttraining",
    met: { leicht: 3.0, moderat: 3.5, intensiv: 6.0 },
    uncertainty: 0.3,
    keywords: ["kraft", "gewicht", "hantel", "gym", "studio", "muskel"],
  },
  {
    id: "zirkel",
    label: "Zirkel / HIIT",
    met: { leicht: 4.5, moderat: 6.0, intensiv: 8.0 },
    uncertainty: 0.25,
    keywords: ["zirkel", "hiit", "intervall", "crossfit", "bootcamp"],
  },
  {
    id: "gehen",
    label: "Gehen / Spaziergang",
    met: { leicht: 2.8, moderat: 3.5, intensiv: 4.3 },
    uncertainty: 0.15,
    keywords: ["gehen", "spazier", "walking", "nordic"],
  },
  {
    id: "wandern",
    label: "Wandern",
    met: { leicht: 5.3, moderat: 6.0, intensiv: 7.3 },
    uncertainty: 0.15,
    keywords: ["wandern", "berg", "trekking"],
  },
  {
    id: "laufen",
    label: "Laufen",
    met: { leicht: 8.0, moderat: 9.8, intensiv: 11.0 },
    uncertainty: 0.15,
    keywords: ["laufen", "joggen", "jogging", "running", "lauf"],
  },
  {
    id: "radfahren",
    label: "Radfahren",
    met: { leicht: 4.0, moderat: 6.8, intensiv: 8.0 },
    uncertainty: 0.15,
    keywords: ["rad", "fahrrad", "bike", "cycling", "spinning"],
  },
  {
    id: "schwimmen",
    label: "Schwimmen",
    met: { leicht: 5.8, moderat: 8.0, intensiv: 9.8 },
    uncertainty: 0.2,
    keywords: ["schwimm", "kraul", "brust"],
  },
  {
    id: "rudern",
    label: "Rudern",
    met: { leicht: 4.8, moderat: 7.0, intensiv: 8.5 },
    uncertainty: 0.2,
    keywords: ["rudern", "rowing", "ergometer"],
  },
  {
    id: "crosstrainer",
    label: "Crosstrainer",
    met: { leicht: 5.0, moderat: 6.8, intensiv: 9.0 },
    uncertainty: 0.2,
    keywords: ["crosstrainer", "ellipsen", "stepper"],
  },
  {
    id: "ballsport",
    label: "Ballsport",
    met: { leicht: 6.0, moderat: 7.0, intensiv: 8.0 },
    uncertainty: 0.25,
    keywords: ["fußball", "fussball", "basketball", "handball", "volleyball", "tennis", "ball"],
  },
  {
    id: "yoga",
    label: "Yoga / Gymnastik",
    met: { leicht: 2.5, moderat: 3.0, intensiv: 4.0 },
    uncertainty: 0.2,
    keywords: ["yoga", "pilates", "gymnastik", "dehnen", "mobility"],
  },
  {
    id: "sonstiges",
    label: "Sonstiges",
    met: { leicht: 3.5, moderat: 5.0, intensiv: 6.5 },
    uncertainty: 0.3,
    keywords: [],
  },
];

export const DEFAULT_ACTIVITY_ID = "sonstiges";

export function findActivity(id: string | undefined | null): MetActivity {
  return (
    MET_ACTIVITIES.find((activity) => activity.id === id) ??
    MET_ACTIVITIES.find((activity) => activity.id === DEFAULT_ACTIVITY_ID)!
  );
}

/**
 * Best guess at the activity behind a free-text name, for the places where the
 * user types rather than picks ("Spaziergang mit dem Hund"). Falls back to the
 * neutral entry, which is still better than the flat factor it replaces.
 */
export function matchActivityByName(name: string): MetActivity {
  const haystack = name.trim().toLowerCase();
  if (!haystack) return findActivity(DEFAULT_ACTIVITY_ID);

  return (
    MET_ACTIVITIES.find((activity) =>
      activity.keywords.some((keyword) => haystack.includes(keyword)),
    ) ?? findActivity(DEFAULT_ACTIVITY_ID)
  );
}

export function normalizeIntensity(value: string | undefined | null): ActivityIntensity {
  return ACTIVITY_INTENSITIES.includes(value as ActivityIntensity)
    ? (value as ActivityIntensity)
    : "moderat";
}

export interface EnergyEstimate {
  /** On top of resting metabolism — the number to show. */
  netKcal: number;
  /** Including resting metabolism — what most fitness trackers report. */
  grossKcal: number;
  lowKcal: number;
  highKcal: number;
  met: number;
}

/**
 * Returns `null` rather than a zero whenever an input is missing: no duration
 * and no body weight means no estimate, and "0 kcal" would read as a fact.
 */
export function estimateActivityEnergy(input: {
  activityId?: string | null;
  intensity?: string | null;
  minutes?: number | null;
  weightKg?: number | null;
}): EnergyEstimate | null {
  const { minutes, weightKg } = input;
  if (!minutes || minutes <= 0 || !weightKg || weightKg <= 0) return null;

  const activity = findActivity(input.activityId);
  const met = activity.met[normalizeIntensity(input.intensity)];

  // kcal/min = MET × 3.5 ml/kg/min × kg / 200
  const perMinute = (met * 3.5 * weightKg) / 200;
  const grossKcal = perMinute * minutes;
  const netKcal = Math.max(0, ((met - 1) * 3.5 * weightKg * minutes) / 200);

  return {
    netKcal: Math.round(netKcal),
    grossKcal: Math.round(grossKcal),
    lowKcal: Math.round(netKcal * (1 - activity.uncertainty)),
    highKcal: Math.round(netKcal * (1 + activity.uncertainty)),
    met,
  };
}
