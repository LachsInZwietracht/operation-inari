"use client"

import Link from "next/link"

import { formatShortDate } from "@/lib/intake-format"
import { CARE_URGENCY_META, type CareRow } from "@/lib/patient-journey"
import { cn } from "@/lib/utils"

interface CareTableProps {
  rows: CareRow[]
}

const HEAD_CLASSES =
  "font-mono text-[10px] uppercase tracking-[.1em] text-fg-3"

/**
 * The ongoing-care list.
 *
 * The row bar encodes urgency rather than a stage: everyone here already has a
 * plan, so the useful question is who has gone quiet. Columns are limited to
 * facts this system records — there is no adherence signal and no check-in
 * record, and a column of invented percentages would be worse than none.
 */
export function CareTable({ rows }: CareTableProps) {
  return (
    <div className="min-w-0">
      <div className="hidden grid-cols-[4px_minmax(170px,1fr)_130px_150px_120px_110px] items-center gap-x-4 border-b pb-2 lg:grid">
        <span />
        <span className={HEAD_CLASSES}>Patient</span>
        <span className={HEAD_CLASSES}>Planwoche</span>
        <span className={HEAD_CLASSES}>Letzte Beratung</span>
        <span className={HEAD_CLASSES}>Nächster Termin</span>
        <span className={cn(HEAD_CLASSES, "text-right")}>Status</span>
      </div>

      {rows.map((row) => (
        <CareTableRow key={row.id} row={row} />
      ))}
    </div>
  )
}

function CareTableRow({ row }: { row: CareRow }) {
  const meta = CARE_URGENCY_META[row.urgency]

  return (
    <div
      className={cn(
        "grid min-h-14 items-center gap-x-3 border-b transition-colors hover:bg-row-hover",
        "grid-cols-[4px_minmax(0,1fr)_auto] py-2",
        "lg:grid-cols-[4px_minmax(170px,1fr)_130px_150px_120px_110px] lg:gap-x-4 lg:py-0",
      )}
      data-care-urgency={row.urgency}
      data-patient-id={row.id}
    >
      <span
        className="h-full min-h-14 w-1 self-stretch"
        style={{ backgroundColor: meta.color }}
        aria-hidden="true"
      />

      <div className="min-w-0 pl-3 lg:pl-2">
        <Link
          href={`/patienten/${row.id}`}
          className="block truncate text-[13.5px] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {row.displayName}
        </Link>
        <p className="truncate text-[12.5px] text-muted-foreground lg:hidden">
          Woche {row.planWeek} ·{" "}
          {row.lastSessionDate
            ? `Beratung ${formatShortDate(row.lastSessionDate)}`
            : "Noch keine Beratung"}
        </p>
      </div>

      <span className="hidden font-mono text-[12.5px] text-muted-foreground lg:block">
        Woche {row.planWeek}
      </span>

      <span className="hidden truncate font-mono text-[12.5px] text-muted-foreground lg:block">
        {row.lastSessionDate ? formatShortDate(row.lastSessionDate) : "—"}
      </span>

      <span className="hidden truncate font-mono text-[12.5px] text-muted-foreground lg:block">
        {row.nextAppointment ? formatShortDate(row.nextAppointment.date) : "—"}
      </span>

      <span
        className="truncate text-right text-[12.5px] lg:pr-1"
        style={{ color: row.urgency === "ok" ? undefined : meta.color }}
      >
        <span className={row.urgency === "ok" ? "text-muted-foreground" : undefined}>
          {meta.label}
        </span>
      </span>
    </div>
  )
}
