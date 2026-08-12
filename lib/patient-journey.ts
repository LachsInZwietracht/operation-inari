import type {
  CounselingSession,
  DailyMealPlan,
  Patient,
  PatientIntakeLink,
  PatientIntakeSubmission,
  PracticeAppointment,
} from "@/lib/types";

/**
 * The patient journey, from invitation to ongoing care.
 *
 * Inari's screens used to be organized around pages while the actual job is a
 * chain: einladen → prüfen → beraten → planen → betreuen. This module is the
 * single place that answers "where is this person right now?", so Aufnahmen,
 * the care list, and the patient page can never disagree.
 *
 * The two patient screens answer different questions:
 *
 *   Aufnahmen  → Which invitations and first-plan tasks need work now?
 *   Patienten  → Which patient records exist, and who needs attention?
 *
 * Everything is derived from data we already store. There is deliberately no
 * `stage` column: adding one would mean a production migration plus a second
 * source of truth that can drift from the plans and submissions describing it.
 */

// ---------------------------------------------------------------------------
// Intake stages
// ---------------------------------------------------------------------------

export type IntakeStage = "eingeladen" | "fragebogen" | "beratung" | "plan";

/** Pipeline order. Drives grouping, board columns, and progress segments. */
export const INTAKE_STAGE_ORDER: readonly IntakeStage[] = [
  "eingeladen",
  "fragebogen",
  "beratung",
  "plan",
] as const;

export interface IntakeStageMeta {
  /** Practitioner-facing stage name. Words carry the meaning; colour echoes it. */
  label: string;
  /** Sits in the group and board-column head: what this stage is waiting on. */
  columnHint: string;
  /** The single next action this stage implies. */
  action: string;
  /**
   * CSS custom property holding the stage colour, identical in both themes.
   * Used inline because these are data-driven values Tailwind cannot see at
   * build time — see `--stage-*` in `app/globals.css`.
   */
  color: string;
}

export const INTAKE_STAGE_META: Record<IntakeStage, IntakeStageMeta> = {
  eingeladen: {
    label: "Eingeladen",
    columnHint: "Wartet auf Antwort",
    action: "Link kopieren",
    color: "var(--stage-eingeladen)",
  },
  fragebogen: {
    label: "Fragebogen zurück",
    columnHint: "Antwort prüfen",
    action: "Prüfen",
    color: "var(--stage-fragebogen)",
  },
  beratung: {
    label: "Beratung",
    columnHint: "Termin & Gespräch",
    action: "Termin planen",
    color: "var(--stage-beratung)",
  },
  plan: {
    label: "Plan erstellen",
    columnHint: "Bereit für Plan",
    action: "Plan starten",
    color: "var(--stage-plan)",
  },
};

/** An invitation this close to expiring is urgent. */
export const URGENT_EXPIRY_DAYS = 1;
/** Time in one stage beyond this is urgent, unless an appointment is booked. */
export const URGENT_WAITING_DAYS = 5;

export interface IntakeRow {
  /** Stable per row: the patient id, or the intake link id for pending invites. */
  id: string;
  /** Null for invitations that have not become a patient record yet. */
  patient: Patient | null;
  /** Practitioner-facing name — the patient's, or the invitation label. */
  displayName: string;
  stage: IntakeStage;
  /** Set for rows that came from an invitation, so the row can offer copy/remind. */
  link: PatientIntakeLink | null;
  /** Set when a questionnaire is waiting for review, so the row can offer "Prüfen". */
  pendingSubmission: PatientIntakeSubmission | null;
  /** ISO timestamp this person entered the current stage — the bar's left edge. */
  enteredStageAt: string;
  /**
   * ISO timestamp the bar runs to. A real deadline where one exists (invitation
   * expiry, booked appointment), otherwise now — an open-ended wait is drawn as
   * "still running", never as an invented due date.
   */
  runsUntil: string;
  /** True when {@link runsUntil} is a real deadline rather than the current time. */
  hasDeadline: boolean;
  /**
   * Whole days until {@link runsUntil}, negative once it has passed. Undefined
   * when there is no deadline. Computed here rather than in the view so a row
   * renders identically on the server and on the client.
   */
  daysUntilDeadline?: number;
  /** The next booked appointment, for rows waiting on a conversation. */
  nextAppointment: PracticeAppointment | null;
  /** Whole days spent in the current stage. */
  waitingDays: number;
  /** Expiry within a day, or an unattended wait. Shown as red meta text only. */
  urgent: boolean;
  /**
   * True when {@link stage} was pinned by hand rather than derived from the
   * records. The board marks these, because a pinned stage is the one place
   * the pipeline can disagree with the underlying data.
   */
  stagePinned: boolean;
  /** The stage the records themselves imply, kept for the "pinned" tooltip. */
  derivedStage: IntakeStage;
}

// ---------------------------------------------------------------------------
// Ongoing care
// ---------------------------------------------------------------------------

/**
 * How overdue a patient under care is.
 *
 * The care list's row bar encodes this rather than a stage: everyone on that
 * screen has a plan, so the useful question is who has slipped.
 */
export type CareUrgency = "erstkontakt" | "ok" | "due" | "overdue";

/** Contact quieter than this is due; twice this is overdue. */
export const CONTACT_DUE_DAYS = 45;
export const CONTACT_OVERDUE_DAYS = 90;

export const CARE_URGENCY_META: Record<CareUrgency, { label: string; color: string }> = {
  erstkontakt: { label: "Erstkontakt offen", color: "var(--stage-beratung)" },
  ok: { label: "Im Plan", color: "var(--urgency-ok)" },
  due: { label: "Fällig", color: "var(--urgency-due)" },
  overdue: { label: "Überfällig", color: "var(--urgency-overdue)" },
};

export interface CareRow {
  id: string;
  patient: Patient;
  displayName: string;
  urgency: CareUrgency;
  /** False while the patient record exists but no patient-bound plan exists. */
  hasLivePlan: boolean;
  /** ISO date the current plan run started — the earliest live plan. */
  planStartedAt: string;
  /** ISO date of the most recent live plan. */
  planLatestAt: string;
  /** Whole weeks since the plan run started, 1-based for display. */
  planWeek: number;
  /** ISO date of the most recent counseling session, if any. */
  lastSessionDate?: string;
  /** Whole days since the last session, or since the plan started if none. */
  daysSinceContact: number;
  nextAppointment: PracticeAppointment | null;
}

// ---------------------------------------------------------------------------
// Shared record grouping
// ---------------------------------------------------------------------------

/**
 * Slim projection of `daily_meal_plans`. Journey derivation never needs meal
 * entries, and loading them for every patient would pull the whole plan tree
 * into a list view.
 */
export interface PatientPlanSummary {
  patientId?: string;
  status?: DailyMealPlan["status"];
  date: string;
}

export interface PatientRecords {
  patients: Patient[];
  links: PatientIntakeLink[];
  submissions: PatientIntakeSubmission[];
  planSummaries: PatientPlanSummary[];
  sessions: CounselingSession[];
  appointments: PracticeAppointment[];
}

interface GroupedRecords {
  linksByPatient: Map<string, PatientIntakeLink[]>;
  /** Invitations with no patient record yet — the rows Aufnahmen adds on top. */
  orphanLinks: PatientIntakeLink[];
  submissionsByPatient: Map<string, PatientIntakeSubmission[]>;
  submissionsByLink: Map<string, PatientIntakeSubmission[]>;
  livePlansByPatient: Map<string, PatientPlanSummary[]>;
  lastSessionByPatient: Map<string, string>;
  nextAppointmentByPatient: Map<string, PracticeAppointment>;
}

function pushInto<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

const MS_PER_DAY = 86_400_000;

/** Whole days between an ISO timestamp and `now`. Negative means in the future. */
export function daysSince(isoDate: string, now: Date): number {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - parsed.getTime()) / MS_PER_DAY);
}

/**
 * Buckets every record by the patient it belongs to, once.
 *
 * Both screens need the same joins, and doing them twice is how the two lists
 * would eventually disagree about who has a plan.
 */
function groupPatientRecords(records: PatientRecords, now: Date): GroupedRecords {
  const linksByPatient = new Map<string, PatientIntakeLink[]>();
  const orphanLinks: PatientIntakeLink[] = [];

  for (const link of records.links) {
    if (link.patientId) pushInto(linksByPatient, link.patientId, link);
    else orphanLinks.push(link);
  }

  // A submission reaches a patient either directly or through its link.
  const linkPatientId = new Map(records.links.map((link) => [link.id, link.patientId]));
  const submissionsByPatient = new Map<string, PatientIntakeSubmission[]>();
  const submissionsByLink = new Map<string, PatientIntakeSubmission[]>();

  for (const submission of records.submissions) {
    pushInto(submissionsByLink, submission.linkId, submission);

    const patientId =
      submission.appliedPatientId ??
      submission.patientId ??
      linkPatientId.get(submission.linkId);
    if (patientId) pushInto(submissionsByPatient, patientId, submission);
  }

  // Archived plans are history, not active work — they must not keep a patient
  // out of Aufnahmen once their plan run has ended.
  const livePlansByPatient = new Map<string, PatientPlanSummary[]>();
  for (const plan of records.planSummaries) {
    if (!plan.patientId || plan.status === "archived") continue;
    pushInto(livePlansByPatient, plan.patientId, plan);
  }

  const lastSessionByPatient = new Map<string, string>();
  for (const session of records.sessions) {
    const existing = lastSessionByPatient.get(session.patientId);
    if (!existing || session.date > existing) {
      lastSessionByPatient.set(session.patientId, session.date);
    }
  }

  // Only appointments still ahead of us answer "is this already handled?".
  const today = toIsoDate(now);
  const nextAppointmentByPatient = new Map<string, PracticeAppointment>();
  for (const appointment of records.appointments) {
    if (!appointment.patientId || appointment.date < today) continue;
    const existing = nextAppointmentByPatient.get(appointment.patientId);
    if (!existing || appointment.date < existing.date) {
      nextAppointmentByPatient.set(appointment.patientId, appointment);
    }
  }

  return {
    linksByPatient,
    orphanLinks,
    submissionsByPatient,
    submissionsByLink,
    livePlansByPatient,
    lastSessionByPatient,
    nextAppointmentByPatient,
  };
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function patientDisplayName(patient: Patient): string {
  return `${patient.lastName}, ${patient.firstName}`;
}

// ---------------------------------------------------------------------------
// Intake derivation
// ---------------------------------------------------------------------------

interface StageTiming {
  enteredStageAt: string;
  runsUntil: string;
  hasDeadline: boolean;
}

/**
 * Resolves one person without a live plan to one intake stage.
 *
 * Ordered by who is blocked: work sitting on the practitioner's desk outranks
 * work sitting with the patient.
 */
function deriveIntakeStage(input: {
  hasPatientRecord: boolean;
  pendingSubmission: PatientIntakeSubmission | null;
  pendingLink: PatientIntakeLink | null;
  lastSessionDate?: string;
}): IntakeStage {
  // Someone answered and is waiting on us. Always the most urgent.
  if (input.pendingSubmission) return "fragebogen";

  // Invited, nothing back yet — the ball is with the patient.
  if (!input.hasPatientRecord || input.pendingLink) return "eingeladen";

  // The data is in. Whether a conversation has happened decides what is next:
  // without one there is nothing to build a plan on.
  return input.lastSessionDate ? "plan" : "beratung";
}

export interface BuildIntakeRowsInput extends PatientRecords {
  /** Injectable for deterministic tests; defaults to now. */
  now?: Date;
}

/**
 * Builds the Aufnahmen list: everyone without a live plan, plus invitations
 * that have not become a patient record yet.
 */
export function buildIntakeRows({
  now = new Date(),
  ...records
}: BuildIntakeRowsInput): IntakeRow[] {
  const grouped = groupPatientRecords(records, now);
  const nowIso = now.toISOString();
  const rows: IntakeRow[] = [];

  for (const patient of records.patients) {
    // A live plan means this person has graduated to ongoing care.
    if (grouped.livePlansByPatient.has(patient.id)) continue;

    const links = grouped.linksByPatient.get(patient.id) ?? [];
    const submissions = grouped.submissionsByPatient.get(patient.id) ?? [];
    const pendingSubmission =
      submissions.find((submission) =>
        submission.status === "new" || submission.status === "reviewed",
      ) ?? null;
    const pendingLink = links.find((link) => link.status === "pending") ?? null;
    const lastSessionDate = grouped.lastSessionByPatient.get(patient.id);
    const nextAppointment = grouped.nextAppointmentByPatient.get(patient.id) ?? null;

    const derivedStage = deriveIntakeStage({
      hasPatientRecord: true,
      pendingSubmission,
      pendingLink,
      lastSessionDate,
    });

    // A hand-pinned stage wins over the derived one. It is the documented
    // exception, so the row carries both and the board can say which is which.
    const override = patient.intakeStageOverride;
    const stage = override ?? derivedStage;
    const stagePinned = Boolean(override) && override !== derivedStage;

    const timing = resolveStageTiming({
      stage,
      nowIso,
      link: pendingLink,
      pendingSubmission,
      appliedSubmission:
        submissions.find((submission) => submission.status === "applied") ?? null,
      patientCreatedAt: patient.createdAt,
      lastSessionDate,
      nextAppointment,
    });

    rows.push({
      id: patient.id,
      patient,
      displayName: patientDisplayName(patient),
      stage,
      link: pendingLink,
      pendingSubmission,
      nextAppointment,
      stagePinned,
      derivedStage,
      ...timing,
      ...resolveUrgency({ timing, now, hasAppointment: Boolean(nextAppointment) }),
    });
  }

  for (const link of grouped.orphanLinks) {
    if (link.status === "revoked") continue;

    const linkSubmissions = grouped.submissionsByLink.get(link.id) ?? [];
    const pendingSubmission =
      linkSubmissions.find((submission) =>
        submission.status === "new" || submission.status === "reviewed",
      ) ?? null;

    // Already applied to a patient: that patient's own row tells the story.
    if (!pendingSubmission && linkSubmissions.length > 0) continue;
    if (!pendingSubmission && link.status !== "pending") continue;

    const stage: IntakeStage = pendingSubmission ? "fragebogen" : "eingeladen";
    const timing = resolveStageTiming({
      stage,
      nowIso,
      link,
      pendingSubmission,
      appliedSubmission: null,
      patientCreatedAt: link.createdAt,
      lastSessionDate: undefined,
      nextAppointment: null,
    });

    rows.push({
      id: link.id,
      patient: null,
      displayName: link.label,
      stage,
      link,
      pendingSubmission,
      nextAppointment: null,
      // An invitation has no patient record, so there is nothing an override
      // could be stored on — this stage is always the derived one.
      stagePinned: false,
      derivedStage: stage,
      ...timing,
      ...resolveUrgency({ timing, now, hasAppointment: false }),
    });
  }

  return sortIntakeRows(rows);
}

function resolveStageTiming(input: {
  stage: IntakeStage;
  nowIso: string;
  link: PatientIntakeLink | null;
  pendingSubmission: PatientIntakeSubmission | null;
  appliedSubmission: PatientIntakeSubmission | null;
  patientCreatedAt: string;
  lastSessionDate?: string;
  nextAppointment: PracticeAppointment | null;
}): StageTiming {
  switch (input.stage) {
    case "eingeladen": {
      const start = input.link?.createdAt ?? input.patientCreatedAt;
      const expiry = input.link?.expiresAt;
      return {
        enteredStageAt: start,
        runsUntil: expiry ?? input.nowIso,
        hasDeadline: Boolean(expiry),
      };
    }
    case "fragebogen":
      return {
        // The clock starts when the answer landed, because that is when the
        // wait became ours.
        enteredStageAt: input.pendingSubmission?.submittedAt ?? input.patientCreatedAt,
        runsUntil: input.nowIso,
        hasDeadline: false,
      };
    case "beratung": {
      const start =
        input.appliedSubmission?.submittedAt ?? input.patientCreatedAt;
      const appointment = input.nextAppointment;
      return {
        enteredStageAt: start,
        runsUntil: appointment ? appointment.date : input.nowIso,
        hasDeadline: Boolean(appointment),
      };
    }
    case "plan":
      return {
        enteredStageAt: input.lastSessionDate ?? input.patientCreatedAt,
        runsUntil: input.nowIso,
        hasDeadline: false,
      };
  }
}

function resolveUrgency(input: {
  timing: StageTiming;
  now: Date;
  hasAppointment: boolean;
}): { waitingDays: number; urgent: boolean; daysUntilDeadline?: number } {
  const waitingDays = Math.max(0, daysSince(input.timing.enteredStageAt, input.now));
  const daysUntilDeadline = input.timing.hasDeadline
    ? -daysSince(input.timing.runsUntil, input.now)
    : undefined;

  // An invitation about to expire is urgent whatever else is true.
  const expiresSoon =
    daysUntilDeadline !== undefined &&
    !input.hasAppointment &&
    daysUntilDeadline <= URGENT_EXPIRY_DAYS;

  // A long wait stops being urgent once someone has booked the conversation:
  // the practitioner has already acted, and flagging it would be noise.
  const waitedTooLong = waitingDays > URGENT_WAITING_DAYS && !input.hasAppointment;

  return { waitingDays, urgent: expiresSoon || waitedTooLong, daysUntilDeadline };
}

/** Pipeline order first, then longest wait, so the oldest work floats up. */
export function sortIntakeRows(rows: IntakeRow[]): IntakeRow[] {
  return [...rows].sort((a, b) => {
    const byStage =
      INTAKE_STAGE_ORDER.indexOf(a.stage) - INTAKE_STAGE_ORDER.indexOf(b.stage);
    if (byStage !== 0) return byStage;
    if (a.waitingDays !== b.waitingDays) return b.waitingDays - a.waitingDays;
    return a.displayName.localeCompare(b.displayName, "de");
  });
}

/** Counts per stage, for group heads, board columns and filter chips. */
export function countByStage(rows: IntakeRow[]): Record<IntakeStage, number> {
  const counts: Record<IntakeStage, number> = {
    eingeladen: 0,
    fragebogen: 0,
    beratung: 0,
    plan: 0,
  };
  for (const row of rows) counts[row.stage] += 1;
  return counts;
}

/** How many of the four progress segments are filled for a stage. */
export function stageProgress(stage: IntakeStage): number {
  return INTAKE_STAGE_ORDER.indexOf(stage) + 1;
}

// ---------------------------------------------------------------------------
// Care derivation
// ---------------------------------------------------------------------------

export interface BuildCareRowsInput extends PatientRecords {
  now?: Date;
}

/**
 * Builds the patient list. Every patient record appears here immediately;
 * people without a plan have the explicit "Erstkontakt offen" status.
 */
export function buildCareRows({ now = new Date(), ...records }: BuildCareRowsInput): CareRow[] {
  const grouped = groupPatientRecords(records, now);
  const rows: CareRow[] = [];

  for (const patient of records.patients) {
    const livePlans = grouped.livePlansByPatient.get(patient.id);
    const hasLivePlan = Boolean(livePlans?.length);
    const dates = hasLivePlan
      ? livePlans!.map((plan) => plan.date).sort()
      : [patient.createdAt];
    const planStartedAt = dates[0];
    const planLatestAt = dates[dates.length - 1];
    const lastSessionDate = grouped.lastSessionByPatient.get(patient.id);

    // Without a session on record, the plan start is the last thing we know
    // happened — treating it as "no contact ever" would flag every new patient.
    const daysSinceContact = Math.max(
      0,
      daysSince(lastSessionDate ?? planStartedAt, now),
    );

    rows.push({
      id: patient.id,
      patient,
      displayName: patientDisplayName(patient),
      urgency: hasLivePlan ? resolveCareUrgency(daysSinceContact) : "erstkontakt",
      hasLivePlan,
      planStartedAt,
      planLatestAt,
      planWeek: hasLivePlan
        ? Math.floor(Math.max(0, daysSince(planStartedAt, now)) / 7) + 1
        : 0,
      lastSessionDate,
      daysSinceContact,
      nextAppointment: grouped.nextAppointmentByPatient.get(patient.id) ?? null,
    });
  }

  return sortCareRows(rows);
}

function resolveCareUrgency(daysSinceContact: number): CareUrgency {
  if (daysSinceContact > CONTACT_OVERDUE_DAYS) return "overdue";
  if (daysSinceContact > CONTACT_DUE_DAYS) return "due";
  return "ok";
}

const CARE_URGENCY_RANK: Record<CareUrgency, number> = {
  erstkontakt: 0,
  overdue: 1,
  due: 2,
  ok: 3,
};

/** Slipped patients first, then alphabetical so the list stays predictable. */
export function sortCareRows(rows: CareRow[]): CareRow[] {
  return [...rows].sort((a, b) => {
    const byUrgency = CARE_URGENCY_RANK[a.urgency] - CARE_URGENCY_RANK[b.urgency];
    if (byUrgency !== 0) return byUrgency;
    return a.displayName.localeCompare(b.displayName, "de");
  });
}
