"use client"

import Link from "next/link"

import { formatShortDate } from "@/lib/intake-format"
import { CARE_URGENCY_META, type CareRow } from "@/lib/patient-journey"
import { cn } from "@/lib/utils"

interface CareTimelineViewProps {
  rows: CareRow[]
  /** The same clock the rows were derived from — see the Patienten page. */
  now: Date
}

const MS_PER_DAY = 86_400_000
const MIN_HALF_SPAN_DAYS = 14
const MAX_HALF_SPAN_DAYS = 120

interface TimelineWindow {
  startMs: number
  endMs: number
}

function resolveWindow(rows: CareRow[], nowMs: number): TimelineWindow {
  let halfSpanDays = MIN_HALF_SPAN_DAYS

  for (const row of rows) {
    const start = new Date(row.planStartedAt).getTime()
    if (!Number.isNaN(start)) {
      halfSpanDays = Math.max(halfSpanDays, (nowMs - start) / MS_PER_DAY)
    }
    const appointment = row.nextAppointment
      ? new Date(row.nextAppointment.date).getTime()
      : Number.NaN
    if (!Number.isNaN(appointment)) {
      halfSpanDays = Math.max(halfSpanDays, (appointment - nowMs) / MS_PER_DAY)
    }
  }

  const halfSpan = Math.min(halfSpanDays, MAX_HALF_SPAN_DAYS) * MS_PER_DAY
  return { startMs: nowMs - halfSpan, endMs: nowMs + halfSpan }
}

function toPercent(iso: string, window: TimelineWindow): number {
  const value = new Date(iso).getTime()
  if (Number.isNaN(value)) return 50
  const ratio = (value - window.startMs) / (window.endMs - window.startMs)
  return Math.min(100, Math.max(0, ratio * 100))
}

/**
 * Ongoing care on a time axis.
 *
 * The bar is how long this patient has been under care, the dot is their next
 * booked appointment. A patient whose bar runs long with no dot ahead of it is
 * the one who has quietly fallen off the schedule — which is exactly the case
 * the table cannot make visible at a glance.
 */
export function CareTimelineView({ rows, now }: CareTimelineViewProps) {
  const nowMs = now.getTime()
  const window = resolveWindow(rows, nowMs)
  const nowPercent = toPercent(now.toISOString(), window)

  const marks = [0, 25, 50, 75, 100].map((percent) => ({
    percent,
    label:
      percent === 50
        ? "HEUTE"
        : formatShortDate(
            new Date(
              window.startMs + ((window.endMs - window.startMs) * percent) / 100,
            ).toISOString(),
          ),
  }))

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-[240px_minmax(0,1fr)_130px] items-center gap-x-4 border-b pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[.1em] text-fg-3">
          Patient
        </span>
        <div className="relative h-4">
          {marks.map((mark) => (
            <span
              key={mark.percent}
              className={cn(
                "absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[.1em]",
                mark.percent === 50 ? "text-muted-foreground" : "text-fg-3",
              )}
              style={{ left: `${mark.percent}%` }}
            >
              {mark.label}
            </span>
          ))}
        </div>
        <span className="text-right font-mono text-[10px] uppercase tracking-[.1em] text-fg-3">
          Nächster Termin
        </span>
      </div>

      {rows.map((row) => {
        const meta = CARE_URGENCY_META[row.urgency]
        const left = toPercent(row.planStartedAt, window)
        const width = Math.max(nowPercent - left, 0.6)
        const appointmentPercent = row.nextAppointment
          ? toPercent(row.nextAppointment.date, window)
          : null

        return (
          <div
            key={row.id}
            className="grid h-14 grid-cols-[240px_minmax(0,1fr)_130px] items-center gap-x-4 border-b transition-colors hover:bg-row-hover"
            data-care-urgency={row.urgency}
            data-patient-id={row.id}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-6 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: meta.color }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <Link
          prefetch={false}
          href={`/patienten/${row.id}`}
                  className="block truncate text-[13.5px] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {row.displayName}
                </Link>
                <span className="block truncate font-mono text-[11px] text-fg-3">
                  {row.hasLivePlan ? `Woche ${row.planWeek}` : "Noch kein Plan"}
                </span>
              </div>
            </div>

            <div className="relative h-14 overflow-hidden">
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
              <span
                className="absolute left-1/2 top-0 h-full w-px bg-fg-4"
                aria-hidden="true"
              />

              <span
                className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: meta.color,
                }}
                aria-hidden="true"
              />

              {appointmentPercent === null ? null : (
                <span
                  className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
                  style={{
                    left: `${appointmentPercent}%`,
                    backgroundColor: "var(--stage-beratung)",
                  }}
                  aria-hidden="true"
                />
              )}
            </div>

            <span className="text-right font-mono text-[12px] text-muted-foreground">
              {row.nextAppointment ? formatShortDate(row.nextAppointment.date) : "—"}
            </span>
          </div>
        )
      })}
    </div>
  )
}
