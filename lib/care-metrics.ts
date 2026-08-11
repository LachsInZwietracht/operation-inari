import { daysSince, type CareRow } from "@/lib/patient-journey";
import type { CounselingSession, PracticeAppointment } from "@/lib/types";

/**
 * Headline numbers for the ongoing-care screen.
 *
 * The design handoff asked for adherence, check-ins, plan runtime and unread
 * messages. None of those exist in this system: there is no adherence signal,
 * no check-in record, no messaging, and a plan is a single day rather than a
 * span. Rather than render invented figures, this module reports the four
 * things the data can actually answer, and the screen says nothing about the
 * rest. See docs/user-priority-feedback.md before adding to this list — a KPI
 * nobody can trace to a record is worse than a missing one.
 */

/** Rolling window for "this week". A trailing 7 days, not a calendar week. */
export const WEEK_DAYS = 7;

export interface CareMetric {
  label: string;
  /** Already formatted — some values are counts, some are durations. */
  value: string;
  /** The comparison line underneath. Empty string renders no line. */
  comparison: string;
  /** Drives the comparison line's colour. */
  tone: "neutral" | "warning" | "problem";
}

export interface BuildCareMetricsInput {
  rows: CareRow[];
  sessions: CounselingSession[];
  /**
   * Live plan documents across all patients. A patient can hold several — a
   * plan here is one day — so this is not the same number as `rows.length`.
   */
  livePlanCount: number;
  now: Date;
}

function withinLastDays(iso: string, days: number, now: Date): boolean {
  const elapsed = daysSince(iso, now);
  return elapsed >= 0 && elapsed < days;
}

function withinPreviousWeek(iso: string, now: Date): boolean {
  const elapsed = daysSince(iso, now);
  return elapsed >= WEEK_DAYS && elapsed < WEEK_DAYS * 2;
}

export function buildCareMetrics({
  rows,
  sessions,
  livePlanCount,
  now,
}: BuildCareMetricsInput): CareMetric[] {
  const startedThisWeek = rows.filter((row) =>
    withinLastDays(row.planStartedAt, WEEK_DAYS, now),
  ).length;

  const planDatesThisWeek = rows.filter((row) =>
    withinLastDays(row.planLatestAt, WEEK_DAYS, now),
  ).length;

  const averageWeeks = rows.length
    ? rows.reduce((sum, row) => sum + row.planWeek, 0) / rows.length
    : 0;

  const patientIds = new Set(rows.map((row) => row.id));
  const relevantSessions = sessions.filter((session) => patientIds.has(session.patientId));
  const sessionsThisWeek = relevantSessions.filter((session) =>
    withinLastDays(session.date, WEEK_DAYS, now),
  ).length;
  const sessionsLastWeek = relevantSessions.filter((session) =>
    withinPreviousWeek(session.date, now),
  ).length;

  const slipping = rows.filter((row) => row.urgency !== "ok").length;

  return [
    {
      label: "Aktive Patienten",
      value: String(rows.length),
      comparison: startedThisWeek
        ? `${startedThisWeek} neu diese Woche`
        : "Keine neuen diese Woche",
      tone: "neutral",
    },
    {
      label: "Pläne aktiv",
      value: String(livePlanCount),
      comparison: planDatesThisWeek
        ? `${planDatesThisWeek} diese Woche bearbeitet`
        : "Diese Woche keiner bearbeitet",
      tone: planDatesThisWeek ? "neutral" : "warning",
    },
    {
      label: "ø Betreuungsdauer",
      value: rows.length ? `${averageWeeks.toFixed(1)} Wo.` : "—",
      comparison: slipping
        ? `${slipping} ohne aktuellen Kontakt`
        : "Alle im Kontaktfenster",
      tone: slipping ? "problem" : "neutral",
    },
    {
      label: "Beratungen diese Woche",
      value: String(sessionsThisWeek),
      comparison: `Vorwoche: ${sessionsLastWeek}`,
      tone: sessionsThisWeek < sessionsLastWeek ? "warning" : "neutral",
    },
  ];
}

export interface AttentionItem {
  id: string;
  name: string;
  /** Why this patient surfaced, in the practitioner's own words. */
  reason: string;
  /** How long it has been true. */
  timing: string;
  tone: "warning" | "problem";
  href: string;
}

/**
 * The "Braucht Aufmerksamkeit" column.
 *
 * Two signals, both traceable to a record: contact that has gone quiet, and a
 * patient under care with nothing booked. Overdue outranks due, and quiet
 * contact outranks a missing appointment, so the top of the column is always
 * the thing that has been wrong longest.
 */
export function buildAttentionItems(rows: CareRow[]): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const row of rows) {
    if (row.urgency !== "ok") {
      items.push({
        id: `${row.id}-kontakt`,
        name: row.displayName,
        reason: row.lastSessionDate ? "Kontakt überfällig" : "Noch keine Beratung",
        timing: `seit ${row.daysSinceContact} Tagen`,
        tone: row.urgency === "overdue" ? "problem" : "warning",
        href: `/patienten/${row.id}`,
      });
      continue;
    }

    if (!row.nextAppointment) {
      items.push({
        id: `${row.id}-termin`,
        name: row.displayName,
        reason: "Kein Folgetermin",
        timing: `Woche ${row.planWeek}`,
        tone: "warning",
        href: `/patienten/${row.id}`,
      });
    }
  }

  return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "problem" ? -1 : 1));
}

export interface UpcomingAppointment {
  appointment: PracticeAppointment;
  patientName: string;
}

/** The next few booked appointments across every patient under care. */
export function buildUpcomingAppointments(
  rows: CareRow[],
  limit = 5,
): UpcomingAppointment[] {
  return rows
    .filter((row): row is CareRow & { nextAppointment: PracticeAppointment } =>
      Boolean(row.nextAppointment),
    )
    .map((row) => ({ appointment: row.nextAppointment, patientName: row.displayName }))
    .sort((a, b) => a.appointment.date.localeCompare(b.appointment.date))
    .slice(0, limit);
}

export interface DayActivity {
  /** ISO date of the day. */
  date: string;
  /** Two-letter German weekday, for the axis. */
  initial: string;
  count: number;
}

/*
 * Two letters, not one: Montag and Mittwoch both start with M, and Dienstag
 * and Donnerstag both with D, so a single letter makes four of the seven days
 * unreadable. Indexed by Date#getDay, which starts on Sunday.
 */
const WEEKDAY_INITIALS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/**
 * Counseling sessions per day over the last week.
 *
 * Stands in for the handoff's adherence bars, which need a signal this system
 * does not collect. This one is the same shape and made of real records.
 */
export function buildWeekActivity(
  sessions: CounselingSession[],
  rows: CareRow[],
  now: Date,
): DayActivity[] {
  const patientIds = new Set(rows.map((row) => row.id));
  const counts = new Map<string, number>();

  for (const session of sessions) {
    if (!patientIds.has(session.patientId)) continue;
    counts.set(session.date, (counts.get(session.date) ?? 0) + 1);
  }

  return Array.from({ length: WEEK_DAYS }, (_, index) => {
    const day = new Date(now);
    day.setDate(day.getDate() - (WEEK_DAYS - 1 - index));
    const date = day.toISOString().slice(0, 10);
    return {
      date,
      initial: WEEKDAY_INITIALS[day.getDay()],
      count: counts.get(date) ?? 0,
    };
  });
}
