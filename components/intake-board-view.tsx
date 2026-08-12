"use client"

import { useState } from "react"
import Link from "next/link"
import { GripVertical, MoveRight, Pin, RotateCcw } from "lucide-react"

import { IntakeRowAction } from "@/components/intake-row-action"
import { IntakeStageProgress } from "@/components/intake-stage-progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { intakeStatusLabel, intakeTimestampLabel } from "@/lib/intake-format"
import {
  INTAKE_STAGE_META,
  INTAKE_STAGE_ORDER,
  type IntakeRow,
  type IntakeStage,
} from "@/lib/patient-journey"
import { cn } from "@/lib/utils"

/** Drag payload: the row id, resolved back to a row by the board. */
const INTAKE_DRAG_ROW = "application/x-inari-intake-row"

interface IntakeBoardViewProps {
  rows: IntakeRow[]
  onReview: (row: IntakeRow) => void
  /** A card was moved to another stage — the parent resolves what that requires. */
  onMove: (row: IntakeRow, to: IntakeStage) => void
  /** Drop a hand-pinned stage and go back to the derived one. */
  onClearOverride: (row: IntakeRow) => void
  failedRowIds?: ReadonlySet<string>
}

/**
 * Aufnahmen as four columns — the same rows as the list, arranged by stage.
 *
 * All four columns are always shown, including empty ones: the shape of the
 * pipeline is the point, and a column that disappears when it empties hides
 * exactly the fact worth noticing.
 *
 * Layout is one rule rather than a set of breakpoints. Each column asks for
 * 268px and refuses to shrink, but is free to grow; so on a wide screen the
 * four share the width equally, and on a narrow one the track scrolls sideways
 * and stays a board instead of collapsing into a stack of lists.
 *
 * Dragging a card states an intent, not a fact — see lib/intake-transitions.ts.
 * The same moves sit on a menu per card, because drag-and-drop is unusable with
 * a keyboard and unreliable on a tablet.
 */
export function IntakeBoardView({
  rows,
  onReview,
  onMove,
  onClearOverride,
  failedRowIds,
}: IntakeBoardViewProps) {
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null)

  function handleDrop(stage: IntakeStage, rowId: string) {
    setDraggingRowId(null)
    const row = rows.find((candidate) => candidate.id === rowId)
    if (row && row.stage !== stage) onMove(row, stage)
  }

  return (
    // The page inset is cancelled and reapplied as padding, so the track can
    // scroll to the viewport edge instead of ending in a 22px gutter.
    <div className="-mx-[22px] overflow-x-auto px-[22px] pb-2">
      <div className="flex snap-x gap-4">
        {INTAKE_STAGE_ORDER.map((stage) => (
          <IntakeBoardColumn
            key={stage}
            stage={stage}
            rows={rows.filter((row) => row.stage === stage)}
            onReview={onReview}
            onMove={onMove}
            onClearOverride={onClearOverride}
            onDropRow={handleDrop}
            draggingRowId={draggingRowId}
            onDragStateChange={setDraggingRowId}
            failedRowIds={failedRowIds}
          />
        ))}
      </div>
    </div>
  )
}

interface IntakeBoardColumnProps {
  stage: IntakeStage
  rows: IntakeRow[]
  onReview: (row: IntakeRow) => void
  onMove: (row: IntakeRow, to: IntakeStage) => void
  onClearOverride: (row: IntakeRow) => void
  onDropRow: (stage: IntakeStage, rowId: string) => void
  draggingRowId: string | null
  onDragStateChange: (rowId: string | null) => void
  failedRowIds?: ReadonlySet<string>
}

function IntakeBoardColumn({
  stage,
  rows,
  onReview,
  onMove,
  onClearOverride,
  onDropRow,
  draggingRowId,
  onDragStateChange,
  failedRowIds,
}: IntakeBoardColumnProps) {
  const meta = INTAKE_STAGE_META[stage]
  const [isOver, setIsOver] = useState(false)

  // A card dropped on its own column is a no-op, so that column gets no
  // highlight — the practitioner should only see where a move actually lands.
  const draggedRowIsElsewhere =
    draggingRowId !== null && !rows.some((row) => row.id === draggingRowId)
  const showDropTarget = isOver && draggedRowIsElsewhere

  return (
    <section
      className={cn(
        "flex w-[268px] shrink-0 grow basis-[268px] snap-start flex-col rounded-[10px] px-1 transition-colors",
        showDropTarget && "bg-row-hover",
      )}
      // The ring takes the stage's own colour, so the drop target says which
      // stage you are about to claim rather than just "here".
      style={showDropTarget ? { boxShadow: `inset 0 0 0 2px ${meta.color}` } : undefined}
      aria-label={meta.label}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(INTAKE_DRAG_ROW)) return
        // Without preventDefault the browser refuses the drop entirely.
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
        setIsOver(true)
      }}
      onDragLeave={(event) => {
        // Moving between a column's own children fires dragleave on the column;
        // ignore those so the highlight does not flicker.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setIsOver(false)
      }}
      onDrop={(event) => {
        const rowId = event.dataTransfer.getData(INTAKE_DRAG_ROW)
        setIsOver(false)
        if (!rowId) return
        event.preventDefault()
        onDropRow(stage, rowId)
      }}
    >
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

      <div className="flex flex-1 flex-col gap-2 pt-3">
        {rows.map((row) => (
          <IntakeBoardCard
            key={row.id}
            row={row}
            onReview={onReview}
            onMove={onMove}
            onClearOverride={onClearOverride}
            onDragStateChange={onDragStateChange}
            isDragging={draggingRowId === row.id}
            disabled={failedRowIds?.has(row.id)}
          />
        ))}

        {rows.length === 0 ? (
          <p
            className={cn(
              "rounded-[9px] py-6 text-center text-[11.5px] text-fg-4 transition-colors",
              draggedRowIsElsewhere && "border border-dashed",
            )}
          >
            {draggedRowIsElsewhere ? "Hierher ziehen" : "Nichts offen"}
          </p>
        ) : null}
      </div>
    </section>
  )
}

interface IntakeBoardCardProps {
  row: IntakeRow
  onReview: (row: IntakeRow) => void
  onMove: (row: IntakeRow, to: IntakeStage) => void
  onClearOverride: (row: IntakeRow) => void
  onDragStateChange: (rowId: string | null) => void
  isDragging: boolean
  disabled?: boolean
}

function IntakeBoardCard({
  row,
  onReview,
  onMove,
  onClearOverride,
  onDragStateChange,
  isDragging,
  disabled,
}: IntakeBoardCardProps) {
  const meta = INTAKE_STAGE_META[row.stage]

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(INTAKE_DRAG_ROW, row.id)
        event.dataTransfer.effectAllowed = "move"
        onDragStateChange(row.id)
      }}
      onDragEnd={() => onDragStateChange(null)}
      className={cn(
        "group rounded-[9px] border border-l-[3px] bg-panel p-3 transition-colors hover:bg-row-hover",
        isDragging && "opacity-40",
      )}
      style={{ borderLeftColor: meta.color }}
      data-intake-stage={row.stage}
      data-patient-id={row.patient?.id}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical
          className="mt-0.5 size-3.5 shrink-0 cursor-grab text-fg-4 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          {row.patient ? (
            <Link
          prefetch={false}
          href={`/patienten/${row.patient.id}`}
              // An anchor is natively draggable and would set its own payload,
              // so the card's drag would never carry the row id.
              draggable={false}
              className="block truncate text-[13.5px] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {row.displayName}
            </Link>
          ) : (
            <span className="block truncate text-[13.5px] font-medium">{row.displayName}</span>
          )}
        </div>

        {row.stagePinned ? (
          <Pin
            className="mt-0.5 size-3 shrink-0 text-[var(--urgency-due)]"
            aria-label={`Stufe von Hand gesetzt. Die Daten sprechen für „${INTAKE_STAGE_META[row.derivedStage].label}".`}
          />
        ) : null}

        <IntakeMoveMenu row={row} onMove={onMove} onClearOverride={onClearOverride} />
      </div>

      <p className="mt-1 truncate pl-5 font-mono text-[11.5px] text-fg-3">
        {intakeTimestampLabel(row)}
      </p>
      <p
        className={cn(
          "truncate pl-5 text-[12.5px]",
          row.urgent ? "text-[var(--urgency-overdue)]" : "text-muted-foreground",
        )}
      >
        {intakeStatusLabel(row)}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 pl-5">
        <IntakeStageProgress stage={row.stage} />
        <IntakeRowAction row={row} onReview={onReview} disabled={disabled} />
      </div>
    </article>
  )
}

/**
 * The same moves the drag offers, reachable by keyboard and on touch, where
 * HTML5 drag-and-drop does not work at all.
 */
function IntakeMoveMenu({
  row,
  onMove,
  onClearOverride,
}: {
  row: IntakeRow
  onMove: (row: IntakeRow, to: IntakeStage) => void
  onClearOverride: (row: IntakeRow) => void
}) {
  const targets = INTAKE_STAGE_ORDER.filter((stage) => stage !== row.stage)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="-mr-1 -mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-fg-3 opacity-0 transition-opacity hover:bg-row-hover hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
        aria-label={`${row.displayName} in eine andere Stufe verschieben`}
      >
        <MoveRight className="size-3.5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px] font-normal text-fg-3">
          Verschieben nach
        </DropdownMenuLabel>
        {targets.map((stage) => (
          <DropdownMenuItem
            key={stage}
            className="gap-2 text-[12.5px]"
            onSelect={() => onMove(row, stage)}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: INTAKE_STAGE_META[stage].color }}
              aria-hidden="true"
            />
            {INTAKE_STAGE_META[stage].label}
          </DropdownMenuItem>
        ))}

        {row.stagePinned ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-[12.5px]"
              onSelect={() => onClearOverride(row)}
            >
              <RotateCcw className="size-3 shrink-0 text-fg-3" aria-hidden="true" />
              Wieder automatisch ({INTAKE_STAGE_META[row.derivedStage].label})
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
