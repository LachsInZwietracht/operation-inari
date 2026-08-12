"use client"

import Link from "next/link"

import { IntakeRowAction } from "@/components/intake-row-action"
import { IntakeStageProgress } from "@/components/intake-stage-progress"
import { intakeStatusLabel, intakeTimestampLabel } from "@/lib/intake-format"
import {
  INTAKE_STAGE_META,
  INTAKE_STAGE_ORDER,
  type IntakeRow,
  type IntakeStage,
} from "@/lib/patient-journey"
import { cn } from "@/lib/utils"

interface IntakeListViewProps {
  rows: IntakeRow[]
  onReview: (row: IntakeRow) => void
  /** False renders one flat run of rows, for when the sort carries the order. */
  grouped?: boolean
  /** Rows whose last action failed — kept in place with the action disabled. */
  failedRowIds?: ReadonlySet<string>
}

/**
 * Aufnahmen as a grouped list — the default view.
 *
 * Grouped by stage rather than sorted flat, because the practitioner's question
 * is almost never "where is this one person" but "what is waiting on me". The
 * rows run edge to edge: a list this dense reads better as a continuous surface
 * than as a stack of cards.
 */
export function IntakeListView({
  rows,
  onReview,
  grouped = true,
  failedRowIds,
}: IntakeListViewProps) {
  if (!grouped) {
    return (
      <div>
        {rows.map((row) => (
          <IntakeListRow
            key={row.id}
            row={row}
            onReview={onReview}
            disabled={failedRowIds?.has(row.id)}
          />
        ))}
      </div>
    )
  }

  const groups = INTAKE_STAGE_ORDER.map((stage) => ({
    stage,
    rows: rows.filter((row) => row.stage === stage),
  })).filter((group) => group.rows.length > 0)

  return (
    <div>
      {groups.map((group) => (
        <section key={group.stage} aria-label={INTAKE_STAGE_META[group.stage].label}>
          <IntakeGroupHeader stage={group.stage} count={group.rows.length} />
          {group.rows.map((row) => (
            <IntakeListRow
              key={row.id}
              row={row}
              onReview={onReview}
              disabled={failedRowIds?.has(row.id)}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function IntakeGroupHeader({ stage, count }: { stage: IntakeStage; count: number }) {
  const meta = INTAKE_STAGE_META[stage]

  return (
    <div className="flex h-8 items-center gap-2 border-b bg-panel px-[18px]">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: meta.color }}
        aria-hidden="true"
      />
      <span className="text-[12.5px] font-medium">{meta.label}</span>
      <span className="font-mono text-[11px] text-fg-3">{count}</span>
      <span className="ml-auto truncate text-[11px] text-fg-3">{meta.columnHint}</span>
    </div>
  )
}

interface IntakeListRowProps {
  row: IntakeRow
  onReview: (row: IntakeRow) => void
  disabled?: boolean
}

function IntakeListRow({ row, onReview, disabled }: IntakeListRowProps) {
  const meta = INTAKE_STAGE_META[row.stage]

  return (
    <div
      className={cn(
        "grid min-h-11 items-center gap-x-3 border-b pr-[18px] transition-colors hover:bg-row-hover",
        // The handoff's column widths, once there is room for them. Below that
        // the meta columns wrap under the name rather than being truncated away.
        "grid-cols-[4px_minmax(0,1fr)_auto] py-2",
        "lg:grid-cols-[4px_minmax(200px,1fr)_210px_200px_140px_130px] lg:gap-x-4 lg:py-0",
      )}
      data-intake-stage={row.stage}
      data-patient-id={row.patient?.id}
    >
      <span
        className="h-full min-h-11 w-1 self-stretch"
        style={{ backgroundColor: meta.color }}
        aria-hidden="true"
      />

      <div className="min-w-0 pl-3 lg:pl-2">
        {row.patient ? (
          <Link
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
        {/* Below the handoff's breakpoint the two meta columns live here. */}
        <p
          className={cn(
            "truncate text-[12.5px] lg:hidden",
            row.urgent ? "text-[var(--urgency-overdue)]" : "text-muted-foreground",
          )}
        >
          {intakeTimestampLabel(row)} · {intakeStatusLabel(row)}
        </p>
      </div>

      <span className="hidden truncate font-mono text-[12.5px] text-muted-foreground lg:block">
        {intakeTimestampLabel(row)}
      </span>

      <span
        className={cn(
          "hidden truncate text-[12.5px] lg:block",
          row.urgent ? "text-[var(--urgency-overdue)]" : "text-muted-foreground",
        )}
      >
        {intakeStatusLabel(row)}
      </span>

      <span className="hidden lg:block">
        <IntakeStageProgress stage={row.stage} />
      </span>

      <span className="flex justify-end">
        <IntakeRowAction row={row} onReview={onReview} disabled={disabled} />
      </span>
    </div>
  )
}
