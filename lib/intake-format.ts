import { URGENT_EXPIRY_DAYS, type IntakeRow } from "@/lib/patient-journey";

const deDE = "de-DE";

/**
 * Practitioner-facing text for an Aufnahmen row.
 *
 * Kept out of the components because all three views — Liste, Zeitachse, Board —
 * show the same two strings, and a row that reads differently depending on which
 * tab you are on is a row nobody trusts.
 */

/** "28.07." — day and month, the way a calendar entry is spoken. */
export function formatShortDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(deDE, { day: "2-digit", month: "2-digit" }).format(
    parsed,
  );
}

/** "03.08., 14:20" — used where the exact moment matters, e.g. a reply landing. */
export function formatShortDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const date = formatShortDate(iso);
  const time = new Intl.DateTimeFormat(deDE, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
  return `${date}, ${time}`;
}

function pluralDays(days: number): string {
  return days === 1 ? "1 Tag" : `${days} Tagen`;
}

/** When this person entered their current stage, e.g. "Eingeladen 28.07.". */
export function intakeTimestampLabel(row: IntakeRow): string {
  switch (row.stage) {
    case "eingeladen":
      return `Eingeladen ${formatShortDate(row.enteredStageAt)}`;
    case "fragebogen":
      // The minute matters here: it is the moment the wait became ours.
      return `Eingegangen ${formatShortDateTime(row.enteredStageAt)}`;
    case "beratung":
      return `Aufgenommen ${formatShortDate(row.enteredStageAt)}`;
    case "plan":
      // Keep the arrival visible even when a practitioner reviewed it later.
      // Without this, a received form and a reviewed form look like one event.
      return row.questionnaireReceivedAt
        ? `Eingegangen ${formatShortDateTime(row.questionnaireReceivedAt)}`
        : `Beratung ${formatShortDate(row.enteredStageAt)}`;
  }
}

/** What the stage is waiting on, e.g. "Läuft in 2 Tagen ab". */
export function intakeStatusLabel(row: IntakeRow): string {
  switch (row.stage) {
    case "eingeladen": {
      const daysLeft = row.daysUntilDeadline;
      if (daysLeft === undefined) return `Offen seit ${pluralDays(row.waitingDays)}`;
      if (daysLeft < 0) return "Abgelaufen";
      if (daysLeft === 0) return "Läuft heute ab";
      if (daysLeft <= URGENT_EXPIRY_DAYS) return "Läuft morgen ab";
      // The row turns red for whichever clock ran out. Once the wait is what
      // made it urgent, showing a comfortable expiry date in red would point
      // the practitioner at the wrong problem.
      if (row.urgent) return `Offen seit ${pluralDays(row.waitingDays)}`;
      return `Läuft in ${pluralDays(daysLeft)} ab`;
    }
    case "fragebogen":
      return row.waitingDays === 0
        ? "Prüfung offen"
        : `Wartet seit ${pluralDays(row.waitingDays)}`;
    case "beratung":
      return row.nextAppointment
        ? `Termin ${formatShortDate(row.nextAppointment.date)}`
        : `Ohne Termin seit ${pluralDays(row.waitingDays)}`;
    case "plan":
      if (row.intakeAppliedAt) {
        return row.waitingDays === 0
          ? "Heute übernommen · Plan bereit"
          : `Übernommen ${formatShortDate(row.intakeAppliedAt)} · Plan bereit`;
      }
      return row.waitingDays === 0
        ? "Seit heute bereit"
        : `Bereit seit ${pluralDays(row.waitingDays)}`;
  }
}
