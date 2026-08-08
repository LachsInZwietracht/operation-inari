import type {
  DailyMealPlan,
  Patient,
  PatientIntakeLink,
  PatientIntakeSubmission,
} from "@/lib/types";

/**
 * The patient pipeline.
 *
 * Inari's screens used to be organized around pages (Patienten, Onboarding,
 * Workflows) while the actual job is a chain: einladen → prüfen → planen. This
 * module is the single place that answers "where is this person right now?", so
 * the patient list, the dashboard queue, and the patient page all agree.
 *
 * Everything here is derived from data we already store — there is deliberately
 * no `status` column. Adding one would mean a production migration plus a second
 * source of truth that can drift from the plans and submissions it describes.
 */
export type PatientPipelineStatus =
  | "antwort_da"
  | "bereit"
  | "faellig"
  | "plan_aktiv"
  | "eingeladen";

/** A patient counts as overdue once contact has been quiet this long. */
export const STALE_CONTACT_DAYS = 90;

export interface PatientStatusMeta {
  /** Practitioner-facing state. Words carry the meaning, the dot only echoes it. */
  label: string;
  /** The single next action this state implies. */
  action: string;
  /** Why the patient is in this state, for tooltips and empty-state copy. */
  description: string;
  /**
   * Urgency rank, ascending. Drives both the default list sort and the order of
   * the dashboard queue, so "someone is waiting on you" always floats up.
   */
  order: number;
  /** Tailwind background class for the status dot. Never the only signal. */
  dotClassName: string;
}

export const PATIENT_STATUS_META: Record<PatientPipelineStatus, PatientStatusMeta> = {
  antwort_da: {
    label: "Antwort da",
    action: "Prüfen",
    description: "Der Fragebogen ist ausgefüllt und wartet auf deine Übernahme.",
    order: 0,
    dotClassName: "bg-emerald-500",
  },
  bereit: {
    label: "Bereit für Plan",
    action: "Plan starten",
    description: "Die Daten stehen, es gibt aber noch keinen Ernährungsplan.",
    order: 1,
    dotClassName: "bg-sky-500",
  },
  faellig: {
    label: "Fällig",
    action: "Beratung planen",
    description: `Seit über ${STALE_CONTACT_DAYS} Tagen kein Kontakt.`,
    order: 2,
    dotClassName: "bg-amber-500",
  },
  eingeladen: {
    label: "Eingeladen",
    action: "Erinnern",
    description: "Die Einladung ist verschickt, der Fragebogen noch offen.",
    order: 3,
    dotClassName: "bg-violet-500",
  },
  plan_aktiv: {
    label: "Plan aktiv",
    action: "Öffnen",
    description: "Ein Ernährungsplan läuft und der Kontakt ist aktuell.",
    order: 4,
    dotClassName: "bg-muted-foreground",
  },
};

/** Every status, ordered by urgency — use this for filter bars and queues. */
export const PATIENT_STATUS_ORDER: PatientPipelineStatus[] = (
  Object.keys(PATIENT_STATUS_META) as PatientPipelineStatus[]
).sort((a, b) => PATIENT_STATUS_META[a].order - PATIENT_STATUS_META[b].order);

/**
 * Slim projection of `daily_meal_plans`. Status derivation never needs meal
 * entries, and loading them for every patient would pull the whole plan tree
 * into a list view.
 */
export interface PatientPlanSummary {
  patientId?: string;
  status?: DailyMealPlan["status"];
  date: string;
}

export interface DerivePatientStatusInput {
  /** Intake links belonging to this patient. */
  links?: PatientIntakeLink[];
  /** Submissions belonging to this patient or to one of their links. */
  submissions?: PatientIntakeSubmission[];
  /** Plan summaries belonging to this patient. */
  plans?: PatientPlanSummary[];
  /** ISO date of the most recent counseling session, if any. */
  lastSessionDate?: string;
  /** Injectable for deterministic tests; defaults to now. */
  now?: Date;
}

function daysSince(isoDate: string, now: Date): number {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - parsed.getTime()) / 86_400_000);
}

/**
 * Resolves one patient to one pipeline state.
 *
 * Rules are ordered by who is blocked: work that sits on the practitioner's desk
 * outranks work that sits with the patient.
 */
export function derivePatientStatus({
  links = [],
  submissions = [],
  plans = [],
  lastSessionDate,
  now = new Date(),
}: DerivePatientStatusInput): PatientPipelineStatus {
  // 1. Someone answered and is waiting on us. Always the most urgent.
  if (submissions.some((submission) => submission.status !== "applied")) {
    return "antwort_da";
  }

  // Archived plans are history, not active work.
  const livePlans = plans.filter((plan) => plan.status !== "archived");

  if (livePlans.length === 0) {
    // 2. Invited but nothing came back yet — the ball is with the patient.
    if (links.some((link) => link.status === "pending")) {
      return "eingeladen";
    }
    // 3. Data is in, no plan exists. The core "do the actual job" state.
    return "bereit";
  }

  // 4. A plan exists but the relationship went quiet.
  if (!lastSessionDate || daysSince(lastSessionDate, now) > STALE_CONTACT_DAYS) {
    return "faellig";
  }

  return "plan_aktiv";
}

/**
 * A row in the patient list.
 *
 * Invitations that have not been applied yet have no patient record, so they
 * appear as `patient: null` rows. That is what dissolves the old Onboarding tab:
 * an invited person is not a separate concept, just an earlier pipeline state.
 */
export interface PatientPipelineRow {
  /** Stable per row: the patient id, or the intake link id for pending invites. */
  id: string;
  patient: Patient | null;
  /** Practitioner-facing name — the patient's, or the invitation label. */
  displayName: string;
  status: PatientPipelineStatus;
  /** Set for rows that came from an invitation, so the row can offer copy/remind. */
  link: PatientIntakeLink | null;
  /** Set when a submission is waiting for review, so the row can offer "Prüfen". */
  pendingSubmission: PatientIntakeSubmission | null;
  lastSessionDate?: string;
  /** Most recent plan date across live plans, for the "letzter Plan" column. */
  lastPlanDate?: string;
}

export interface BuildPatientPipelineInput {
  patients: Patient[];
  links: PatientIntakeLink[];
  submissions: PatientIntakeSubmission[];
  planSummaries: PatientPlanSummary[];
  /** Patient id → ISO date of their most recent counseling session. */
  lastSessionByPatient: Map<string, string>;
  now?: Date;
}

function patientDisplayName(patient: Patient): string {
  return `${patient.lastName}, ${patient.firstName}`;
}

/**
 * Builds the unified list: existing patients plus invitations that have not
 * become a patient yet, each resolved to one status.
 */
export function buildPatientPipeline({
  patients,
  links,
  submissions,
  planSummaries,
  lastSessionByPatient,
  now = new Date(),
}: BuildPatientPipelineInput): PatientPipelineRow[] {
  const linksByPatient = new Map<string, PatientIntakeLink[]>();
  const orphanLinks: PatientIntakeLink[] = [];

  for (const link of links) {
    if (link.patientId) {
      const bucket = linksByPatient.get(link.patientId);
      if (bucket) bucket.push(link);
      else linksByPatient.set(link.patientId, [link]);
    } else {
      orphanLinks.push(link);
    }
  }

  // A submission reaches a patient either directly or through its link.
  const linkPatientId = new Map(links.map((link) => [link.id, link.patientId]));
  const submissionsByPatient = new Map<string, PatientIntakeSubmission[]>();
  const submissionsByLink = new Map<string, PatientIntakeSubmission[]>();

  for (const submission of submissions) {
    const bucket = submissionsByLink.get(submission.linkId);
    if (bucket) bucket.push(submission);
    else submissionsByLink.set(submission.linkId, [submission]);

    const patientId =
      submission.appliedPatientId ??
      submission.patientId ??
      linkPatientId.get(submission.linkId);
    if (!patientId) continue;

    const patientBucket = submissionsByPatient.get(patientId);
    if (patientBucket) patientBucket.push(submission);
    else submissionsByPatient.set(patientId, [submission]);
  }

  const plansByPatient = new Map<string, PatientPlanSummary[]>();
  for (const plan of planSummaries) {
    if (!plan.patientId) continue;
    const bucket = plansByPatient.get(plan.patientId);
    if (bucket) bucket.push(plan);
    else plansByPatient.set(plan.patientId, [plan]);
  }

  const rows: PatientPipelineRow[] = patients.map((patient) => {
    const patientLinks = linksByPatient.get(patient.id) ?? [];
    const patientSubmissions = submissionsByPatient.get(patient.id) ?? [];
    const patientPlans = plansByPatient.get(patient.id) ?? [];
    const lastSessionDate = lastSessionByPatient.get(patient.id);

    const status = derivePatientStatus({
      links: patientLinks,
      submissions: patientSubmissions,
      plans: patientPlans,
      lastSessionDate,
      now,
    });

    const lastPlanDate = patientPlans
      .filter((plan) => plan.status !== "archived")
      .reduce<string | undefined>(
        (latest, plan) => (!latest || plan.date > latest ? plan.date : latest),
        undefined,
      );

    return {
      id: patient.id,
      patient,
      displayName: patientDisplayName(patient),
      status,
      link: patientLinks.find((link) => link.status === "pending") ?? null,
      pendingSubmission:
        patientSubmissions.find((submission) => submission.status !== "applied") ?? null,
      lastSessionDate,
      lastPlanDate,
    };
  });

  // Invitations without a patient record yet — the dissolved Onboarding tab.
  for (const link of orphanLinks) {
    if (link.status === "revoked") continue;

    const linkSubmissions = submissionsByLink.get(link.id) ?? [];
    const pendingSubmission =
      linkSubmissions.find((submission) => submission.status !== "applied") ?? null;

    // Already applied to a patient: that patient row above tells the story.
    if (!pendingSubmission && linkSubmissions.length > 0) continue;
    if (!pendingSubmission && link.status !== "pending") continue;

    rows.push({
      id: link.id,
      patient: null,
      displayName: link.label,
      status: pendingSubmission ? "antwort_da" : "eingeladen",
      link,
      pendingSubmission,
    });
  }

  return sortPipelineRows(rows);
}

/** Urgent work first, then alphabetical so the list stays predictable. */
export function sortPipelineRows(rows: PatientPipelineRow[]): PatientPipelineRow[] {
  return [...rows].sort((a, b) => {
    const byUrgency =
      PATIENT_STATUS_META[a.status].order - PATIENT_STATUS_META[b.status].order;
    if (byUrgency !== 0) return byUrgency;
    return a.displayName.localeCompare(b.displayName, "de");
  });
}

/** Counts per status, for the filter chips and the dashboard queue headline. */
export function countByStatus(
  rows: PatientPipelineRow[],
): Record<PatientPipelineStatus, number> {
  const counts = {
    antwort_da: 0,
    bereit: 0,
    faellig: 0,
    eingeladen: 0,
    plan_aktiv: 0,
  } satisfies Record<PatientPipelineStatus, number>;

  for (const row of rows) counts[row.status] += 1;
  return counts;
}
