"use client"

import Link from "next/link"

import { IntakeRowAction } from "@/components/intake-row-action"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatShortDate, formatShortDateTime, intakeStatusLabel } from "@/lib/intake-format"
import { INTAKE_STAGE_META, type IntakeHistoryEvent, type IntakeRow } from "@/lib/patient-journey"
import { cn } from "@/lib/utils"

interface IntakeTimelineViewProps {
  rows: IntakeRow[]
  onReview: (row: IntakeRow) => void
  /** The same clock the rows were derived from — see the Aufnahmen page. */
  now: Date
  failedRowIds?: ReadonlySet<string>
}

const MS_PER_DAY = 86_400_000
/** Never zoom in tighter than this, or a single day fills the whole track. */
const MIN_HALF_SPAN_DAYS = 7
/** Never zoom out further, or everything collapses onto the today line. */
const MAX_HALF_SPAN_DAYS = 60
/** Past this point a label placed after the bar would run off the right edge. */
const LABEL_FLIP_PERCENT = 68
/** A bar starting left of this leaves no room to place the label before it. */
const LABEL_BEFORE_MIN_PERCENT = 28

interface TimelineWindow {
  startMs: number
  endMs: number
  nowMs: number
}

/**
 * Chooses the visible time window.
 *
 * Today is pinned to the middle, so the window has to be symmetric around it —
 * a practitioner reads this to see who is drifting left (waiting too long) and
 * what is coming up on the right, and that only works if the centre is fixed.
 * The half-span grows to fit the data and is clamped at both ends.
 */
function resolveWindow(rows: IntakeRow[], nowMs: number): TimelineWindow {
  let halfSpanDays = MIN_HALF_SPAN_DAYS

  for (const row of rows) {
    const start = new Date(row.enteredStageAt).getTime()
    const end = new Date(row.runsUntil).getTime()
    if (!Number.isNaN(start)) {
      halfSpanDays = Math.max(halfSpanDays, (nowMs - start) / MS_PER_DAY)
    }
    if (!Number.isNaN(end)) {
      halfSpanDays = Math.max(halfSpanDays, (end - nowMs) / MS_PER_DAY)
    }
    // History can reach further back (or forward) than the current stage's
    // own bar — an old invitation must still fall inside the window, or it
    // clamps to the edge and looks like it happened "just now".
    for (const event of row.history) {
      const eventMs = new Date(event.date).getTime()
      if (Number.isNaN(eventMs)) continue
      halfSpanDays = Math.max(halfSpanDays, Math.abs(nowMs - eventMs) / MS_PER_DAY)
    }
  }

  const halfSpan = Math.min(halfSpanDays, MAX_HALF_SPAN_DAYS) * MS_PER_DAY
  return { startMs: nowMs - halfSpan, endMs: nowMs + halfSpan, nowMs }
}

function toPercent(iso: string, window: TimelineWindow): number {
  const value = new Date(iso).getTime()
  if (Number.isNaN(value)) return 50
  const ratio = (value - window.startMs) / (window.endMs - window.startMs)
  // Rows older than the window clamp to the edge rather than disappearing.
  return Math.min(100, Math.max(0, ratio * 100))
}

/**
 * Aufnahmen on a time axis — the same rows as the list, arranged by when.
 *
 * Answers the question the list cannot: who has been sitting still the longest,
 * and what runs out next.
 */
export function IntakeTimelineView({
  rows,
  onReview,
  now,
  failedRowIds,
}: IntakeTimelineViewProps) {
  const window = resolveWindow(rows, now.getTime())

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
          Aktion
        </span>
      </div>

      {rows.map((row) => (
        <IntakeTimelineRow
          key={row.id}
          row={row}
          window={window}
          onReview={onReview}
          disabled={failedRowIds?.has(row.id)}
        />
      ))}
    </div>
  )
}

interface IntakeTimelineRowProps {
  row: IntakeRow
  window: TimelineWindow
  onReview: (row: IntakeRow) => void
  disabled?: boolean
}

function IntakeTimelineRow({ row, window, onReview, disabled }: IntakeTimelineRowProps) {
  const meta = INTAKE_STAGE_META[row.stage]
  const left = toPercent(row.enteredStageAt, window)
  const right = toPercent(row.runsUntil, window)
  const width = Math.max(right - left, 0.6)

  /*
   * Where the label goes, in order of preference:
   *
   *   after   just past the bar's end — the default, reads as a continuation
   *   before  just ahead of the bar's start, when the bar ends too far right
   *   inside  against the bar's own end, when the bar also starts too far left
   *
   * "inside" is the last resort because the label paints over the bar there.
   */
  const placement =
    right <= LABEL_FLIP_PERCENT
      ? "after"
      : left >= LABEL_BEFORE_MIN_PERCENT
        ? "before"
        : "inside"

  return (
    <div
      className="grid h-14 grid-cols-[240px_minmax(0,1fr)_130px] items-center gap-x-4 border-b transition-colors hover:bg-row-hover"
      data-intake-stage={row.stage}
      data-patient-id={row.patient?.id}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-6 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: meta.color }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          {row.patient ? (
            <Link
          prefetch={false}
          href={`/patienten/${row.patient.id}`}
              className="block truncate text-[13.5px] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {row.displayName}
            </Link>
          ) : (
            <span className="block truncate text-[13.5px] font-medium">
              {row.displayName}
            </span>
          )}
          <span className="block truncate font-mono text-[11px] text-fg-3">
            {meta.label}
          </span>
        </div>
      </div>

      {/* overflow-hidden is load-bearing: bar plus label must never spill into
          the action column, whatever the window ends up being. */}
      <div className="relative h-14 overflow-hidden">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        <span className="absolute left-1/2 top-0 h-full w-px bg-fg-4" aria-hidden="true" />

        <span
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            backgroundColor: meta.color,
          }}
          aria-hidden="true"
        />

        {row.history.map((event) => (
          <IntakeHistoryMark key={event.id} event={event} window={window} />
        ))}

        {/* The label sits on the page background so it covers the baseline
            rather than being crossed out by it. */}
        <span
          className={cn(
            "absolute top-1/2 -translate-y-1/2 whitespace-nowrap bg-background px-1.5 text-[11.5px]",
            row.urgent ? "text-[var(--urgency-overdue)]" : "text-muted-foreground",
          )}
          style={
            placement === "after"
              ? { left: `${right}%` }
              : {
                  // Both remaining placements anchor the label's right edge:
                  // ahead of the bar's start, or against the bar's own end.
                  right: `${100 - (placement === "before" ? left : right)}%`,
                  transform: "translate(0, -50%)",
                }
          }
        >
          {intakeStatusLabel(row)}
        </span>
      </div>

      <span className="flex justify-end">
        <IntakeRowAction row={row} onReview={onReview} disabled={disabled} />
      </span>
    </div>
  )
}

/**
 * One dated milestone, marked on the row's own line rather than folded into
 * the current-stage bar — so a practitioner can see the whole way here, not
 * just the last leg.
 */
function IntakeHistoryMark({
  event,
  window,
}: {
  event: IntakeHistoryEvent
  window: TimelineWindow
}) {
  const position = toPercent(event.date, window)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground",
            event.pending ? "bg-background" : "bg-fg-3",
          )}
          style={{
            left: `${position}%`,
            borderColor: event.pending ? "var(--fg-3)" : undefined,
          }}
        />
      </TooltipTrigger>
      <TooltipContent>
        {event.label} · {event.precise ? formatShortDateTime(event.date) : formatShortDate(event.date)}
      </TooltipContent>
    </Tooltip>
  )
}
