import {
  INTAKE_STAGE_META,
  INTAKE_STAGE_ORDER,
  type IntakeRow,
  type IntakeStage,
} from "@/lib/patient-journey";

/**
 * What it would take to move someone into a stage they are not in yet.
 *
 * A stage on the board is *derived* — from a questionnaire that arrived, a
 * patient record that exists, a session that was documented. So dragging a card
 * cannot simply set it; there would be nothing underneath to hold it there, and
 * the card would snap back the moment the data reloaded.
 *
 * Instead a drag states an intent, and this module answers one question: which
 * single fact is missing, and what supplies it? The dialog then offers exactly
 * that action. Apply a waiting questionnaire and the card moves on its own,
 * because the thing the stage is derived from is now true.
 *
 * Where the missing fact cannot be supplied by the practitioner at all — only
 * the invited person can answer their own questionnaire — the dialog says so
 * rather than pretending.
 */

/** How the target stage can be reached. */
export type IntakeTransitionKind =
  /** The practitioner can supply the missing fact here and now. */
  | "actionable"
  /** Only the invited person can produce it; we can nudge, nothing more. */
  | "blocked"
  /** Moving backwards, which no action undoes. */
  | "backwards";

/** What the dialog's primary button should do. */
export type IntakeTransitionAction =
  /** Open the questionnaire review — applying it creates the patient record. */
  | { type: "review"; label: string }
  /** Open the invitation dialog. */
  | { type: "invite"; label: string }
  /** Copy the existing invitation link. */
  | { type: "copy-link"; label: string; url: string }
  /** Navigate somewhere that supplies the fact (a form, the calendar). */
  | { type: "navigate"; label: string; href: string };

export interface IntakeTransition {
  from: IntakeStage;
  to: IntakeStage;
  kind: IntakeTransitionKind;
  /** Dialog heading — names the move in the practitioner's words. */
  title: string;
  /** The single missing fact, in plain German. */
  explanation: string;
  /** The action that supplies it, when one exists. */
  action: IntakeTransitionAction | null;
  /**
   * Whether a manual override is offered as a secondary escape hatch.
   * False for invitation-only rows: an override is stored on the patient
   * record, and those rows do not have one yet.
   */
  canOverride: boolean;
  /** Why the override is a last resort, shown next to it. */
  overrideWarning: string;
}

const OVERRIDE_WARNING =
  "Die Stufe wird dann von Hand gesetzt und stimmt nicht mehr mit den hinterlegten Daten überein. Sichtbar für alle im Team und jederzeit zurücknehmbar.";

const NO_PATIENT_OVERRIDE =
  "Für eine offene Einladung gibt es noch keine Patientenakte, an der eine Stufe hängen könnte.";

/**
 * Resolves a drag into the one thing standing between this person and the
 * target stage. Returns null when the card was dropped where it already is.
 */
export function resolveIntakeTransition(
  row: IntakeRow,
  to: IntakeStage,
): IntakeTransition | null {
  if (row.stage === to) return null;

  const from = row.stage;
  const name = row.displayName;
  const toLabel = INTAKE_STAGE_META[to].label;
  const canOverride = Boolean(row.patient);
  const overrideWarning = canOverride ? OVERRIDE_WARNING : NO_PATIENT_OVERRIDE;

  const base = {
    from,
    to,
    title: `${name} nach „${toLabel}" verschieben`,
    canOverride,
    overrideWarning,
  } as const;

  const movingBackwards =
    INTAKE_STAGE_ORDER.indexOf(to) < INTAKE_STAGE_ORDER.indexOf(from);

  switch (to) {
    case "eingeladen": {
      return {
        ...base,
        kind: "backwards",
        explanation:
          "Eine Einladung lässt sich nicht zurücknehmen — was bereits eingegangen ist, bleibt eingegangen. Du kannst stattdessen eine neue Einladung schicken.",
        action: { type: "invite", label: "Neue Einladung" },
      };
    }

    case "fragebogen": {
      // The one move nobody in the practice can make: the answer has to come
      // from the invited person.
      return {
        ...base,
        kind: movingBackwards ? "backwards" : "blocked",
        explanation: `Diese Stufe bedeutet, dass ein ausgefüllter Fragebogen zur Prüfung vorliegt. Den kann nur ${name} selbst absenden — du kannst daran erinnern.`,
        action: row.link
          ? { type: "copy-link", label: "Link kopieren", url: row.link.url }
          : { type: "invite", label: "Einladung senden" },
      };
    }

    case "beratung": {
      // A waiting questionnaire is the happy path: applying it creates the
      // patient record, and the card then moves on its own.
      if (row.pendingSubmission) {
        return {
          ...base,
          kind: "actionable",
          explanation:
            "Für diese Person liegen Angaben zur Prüfung vor. Sobald du sie übernimmst, ist die Akte angelegt und die Beratung kann beginnen — die Karte rutscht dann von selbst weiter.",
          action: { type: "review", label: "Angaben prüfen" },
        };
      }

      if (!row.patient) {
        return {
          ...base,
          kind: "actionable",
          explanation:
            "Für die Beratung braucht es eine Patientenakte. Es sind aber noch keine Angaben eingegangen, aus denen sie entstehen könnte — du kannst die Akte von Hand anlegen.",
          action: { type: "navigate", label: "Patient anlegen", href: "/patienten/neu" },
        };
      }

      // Coming back from "Plan erstellen" means undoing a documented session.
      return {
        ...base,
        kind: "backwards",
        explanation: `Für ${name} ist bereits ein Beratungsgespräch dokumentiert — deshalb steht die Karte auf „Plan erstellen". Ein dokumentiertes Gespräch lässt sich hier nicht zurücknehmen.`,
        action: row.patient
          ? {
              type: "navigate",
              label: "Beratungen ansehen",
              href: `/patienten/${row.patient.id}`,
            }
          : null,
      };
    }

    case "plan": {
      if (!row.patient) {
        return {
          ...base,
          kind: "actionable",
          explanation:
            "Bevor ein Plan entstehen kann, braucht es eine Patientenakte und ein dokumentiertes Beratungsgespräch. Beides fehlt noch.",
          action: { type: "navigate", label: "Patient anlegen", href: "/patienten/neu" },
        };
      }

      if (row.pendingSubmission) {
        return {
          ...base,
          kind: "actionable",
          explanation:
            "Es liegen noch ungeprüfte Angaben vor. Übernimm sie zuerst — danach fehlt für den Plan nur noch das dokumentierte Beratungsgespräch.",
          action: { type: "review", label: "Angaben prüfen" },
        };
      }

      return {
        ...base,
        kind: "actionable",
        explanation: `„Plan erstellen" heißt: das Beratungsgespräch hat stattgefunden und ist dokumentiert. Für ${name} fehlt diese Dokumentation noch.`,
        action: {
          type: "navigate",
          label: "Beratung dokumentieren",
          href: `/patienten/${row.patient.id}/beratungen/neu`,
        },
      };
    }
  }
}
