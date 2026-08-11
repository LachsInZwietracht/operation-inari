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

interface IntakeBoardViewProps {
  rows: IntakeRow[]
  onReview: (row: IntakeRow) => void
  failedRowIds?: ReadonlySet<string>
}

/**
 * Aufnahmen as four columns — the same rows as the list, arranged by stage.
 *
 * All four columns are always shown, including empty ones: the shape of the
 * pipeline is the point, and a column that disappears when it empties hides
 * exactly the fact worth noticing.
 *
 * Cards are not draggable. A stage here is derived from what has actually
 * happened — a questionnaire arrived, a session was held — so dragging a card
 * would claim a state the underlying data does not support.
 */
export function IntakeBoardView({ rows, onReview, failedRowIds }: IntakeBoardViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {INTAKE_STAGE_ORDER.map((stage) => (
        <IntakeBoardColumn
          key={stage}
          stage={stage}
          rows={rows.filter((row) => row.stage === stage)}
          onReview={onReview}
          failedRowIds={failedRowIds}
        />
      ))}
    </div>
  )
}

interface IntakeBoardColumnProps {
  stage: IntakeStage
  rows: IntakeRow[]
  onReview: (row: IntakeRow) => void
  failedRowIds?: ReadonlySet<string>
}

function IntakeBoardColumn({
  stage,
  rows,
  onReview,
  failedRowIds,
}: IntakeBoardColumnProps) {
  const meta = INTAKE_STAGE_META[stage]

  return (
    <section className="min-w-0" aria-label={meta.label}>
      <div className="border-b pb-2">
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: meta.color }}
            aria-hidden="true"
          />
          <span className="truncate text-[12.5px] font-medium">{meta.label}</span>
          <span className="ml-auto font-mono text-[11px] text-fg-3">{rows.length}</span>
        </div>
        <p className="pl-4 text-[11px] text-fg-3">{meta.columnHint}</p>
      </div>

      <div className="flex flex-col gap-2 pt-3">
        {rows.map((row) => (
          <IntakeBoardCard
            key={row.id}
            row={row}
            onReview={onReview}
            disabled={failedRowIds?.has(row.id)}
          />
        ))}
        {rows.length === 0 ? (
          <p className="py-6 text-center text-[11.5px] text-fg-4">Nichts offen</p>
        ) : null}
      </div>
    </section>
  )
}

interface IntakeBoardCardProps {
  row: IntakeRow
  onReview: (row: IntakeRow) => void
  disabled?: boolean
}

function IntakeBoardCard({ row, onReview, disabled }: IntakeBoardCardProps) {
  const meta = INTAKE_STAGE_META[row.stage]

  return (
    <article
      className="rounded-[9px] border border-l-[3px] bg-panel p-3 transition-colors hover:bg-row-hover"
      style={{ borderLeftColor: meta.color }}
      data-intake-stage={row.stage}
      data-patient-id={row.patient?.id}
    >
      {row.patient ? (
        <Link
          href={`/patienten/${row.patient.id}`}
          prefetch={false}
          className="block truncate text-[13.5px] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {row.displayName}
        </Link>
      ) : (
        <span className="block truncate text-[13.5px] font-medium">{row.displayName}</span>
      )}

      <p className="mt-1 truncate font-mono text-[11.5px] text-fg-3">
        {intakeTimestampLabel(row)}
      </p>
      <p
        className={cn(
          "truncate text-[12.5px]",
          row.urgent ? "text-[var(--urgency-overdue)]" : "text-muted-foreground",
        )}
      >
        {intakeStatusLabel(row)}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <IntakeStageProgress stage={row.stage} />
        <IntakeRowAction row={row} onReview={onReview} disabled={disabled} />
      </div>
    </article>
  )
}
