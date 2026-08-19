/**
 * Reads the goal text the intake writes into `patients.patient_goals`.
 *
 * `buildPatientGoals` in ./apply-submission.ts stores the answers as labelled
 * lines, because the column is one free-text field and the record has to stay
 * readable on its own:
 *
 *     Ziel: Abnehmen
 *     Zeithorizont: 3 Monate
 *     Motivation: …
 *
 * Every surface that shows it then puts its own "Ziel" heading in front, so the
 * word arrived twice on screen. Splitting the lines here lets each surface show
 * the part it does not already label, and keeps the stored text untouched — the
 * rows written before this existed parse exactly the same way.
 *
 * A counselor typing free prose into the same field is the normal case, not an
 * error: without a known label the whole text is the goal.
 */
export interface ParsedPatientGoals {
  /** The goal itself, with the intake's own "Ziel:"/"Ziele:" label removed. */
  goal?: string;
  timeframe?: string;
  motivation?: string;
  /** Lines that carried no label the intake writes, kept verbatim. */
  notes?: string;
}

/** Label prefixes `buildPatientGoals` writes, mapped to the field they fill. */
const LABELS: ReadonlyArray<[RegExp, keyof ParsedPatientGoals]> = [
  [/^ziele?\s*:\s*/i, "goal"],
  [/^zeithorizont\s*:\s*/i, "timeframe"],
  [/^motivation\s*:\s*/i, "motivation"],
];

export function parsePatientGoals(raw?: string | null): ParsedPatientGoals {
  const text = raw?.trim();
  if (!text) return {};

  const parsed: ParsedPatientGoals = {};
  const unlabelled: string[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = LABELS.find(([pattern]) => pattern.test(trimmed));
    if (!match) {
      unlabelled.push(trimmed);
      continue;
    }

    const [pattern, field] = match;
    const value = trimmed.replace(pattern, "").trim();
    // A label with nothing behind it says nothing — drop it rather than
    // rendering an empty row.
    if (value) parsed[field] = value;
  }

  if (unlabelled.length > 0) {
    // Free prose with no labels at all *is* the goal. Once a label was found,
    // the leftovers are additional notes instead.
    if (parsed.goal === undefined && !parsed.timeframe && !parsed.motivation) {
      parsed.goal = unlabelled.join("\n");
    } else {
      parsed.notes = unlabelled.join("\n");
    }
  }

  return parsed;
}

/**
 * The goal in one line, for a cell that already carries a "Ziel" label.
 *
 * Falls back to the intake reason, which holds the same goal labels without the
 * timeframe and motivation around them.
 */
export function patientGoalSummary(
  patientGoals?: string | null,
  intakeReason?: string | null,
): string | undefined {
  return parsePatientGoals(patientGoals).goal ?? intakeReason?.trim() ?? undefined;
}
