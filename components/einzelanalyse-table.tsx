"use client"

import { useMemo } from "react"
import type { MealSlotType, NutrientDefinition } from "@/lib/types"
import type { EinzelanalyseTable } from "@/lib/einzelanalyse"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

interface EinzelanalyseTableProps {
  table: EinzelanalyseTable
  nutrientDefinitions: NutrientDefinition[]
  slotLabels: Record<MealSlotType, string>
  /** Body weight in kg used for per-kg display. Required when `table.perKgApplied` is true. */
  bodyWeightKg?: number
}

interface SlotGroup {
  slot: MealSlotType
  rows: EinzelanalyseTable["rows"]
}

function groupRowsBySlot(rows: EinzelanalyseTable["rows"]): SlotGroup[] {
  const groups: SlotGroup[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.slot === row.slot) {
      last.rows.push(row)
    } else {
      groups.push({ slot: row.slot, rows: [row] })
    }
  }
  return groups
}

/**
 * Picks a decimal count appropriate to the magnitude. Mirrors the heuristic in
 * `formatNutrient` but avoids pulling the unit into the formatted string so the
 * unit can be rendered in muted style separately.
 */
function decimalsFor(value: number): number {
  const absolute = Math.abs(value)
  if (absolute === 0) return 0
  if (absolute < 1) return 2
  if (absolute < 10) return 1
  return 0
}

export function EinzelanalyseTableView({
  table,
  nutrientDefinitions,
  slotLabels,
  bodyWeightKg,
}: EinzelanalyseTableProps) {
  const defMap = useMemo(
    () => new Map(nutrientDefinitions.map((d) => [d.id, d])),
    [nutrientDefinitions],
  )

  const slotGroups = useMemo(() => groupRowsBySlot(table.rows), [table.rows])
  const perKgSuffix = table.perKgApplied ? "/kg KG" : ""
  const perKgDivisor =
    table.perKgApplied && typeof bodyWeightKg === "number" && bodyWeightKg > 0
      ? bodyWeightKg
      : 1

  if (table.rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
        Noch keine Lebensmittel im Plan – Einzelbeiträge erscheinen, sobald Einträge
        hinzugefügt werden.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="bg-background sticky left-0 z-10 min-w-[220px]">
            Lebensmittel / Rezept
          </TableHead>
          {table.columns.map((column) => {
            const def = defMap.get(column.nutrientId)
            return (
              <TableHead key={column.nutrientId} className="text-right">
                <div className="flex flex-col items-end leading-tight">
                  <span>{def?.shortName ?? column.nutrientId}</span>
                  <span className="text-muted-foreground text-[10px] font-normal">
                    {def?.unit ?? ""}
                    {perKgSuffix}
                  </span>
                </div>
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>

      <TableBody>
        {slotGroups.map((group) => (
          <SlotGroupRows
            key={group.slot}
            group={group}
            columns={table.columns}
            slotLabel={slotLabels[group.slot]}
          />
        ))}
      </TableBody>

      <TableFooter>
        <TableRow>
          <TableCell className="bg-muted/50 sticky left-0 z-10 font-semibold">
            Tagessumme
          </TableCell>
          {table.columns.map((column) => {
            const displayTotal = column.total / perKgDivisor
            return (
              <TableCell key={column.nutrientId} className="text-right font-semibold">
                {formatNumber(displayTotal, decimalsFor(displayTotal))}
              </TableCell>
            )
          })}
        </TableRow>
      </TableFooter>
    </Table>
  )
}

interface SlotGroupRowsProps {
  group: SlotGroup
  columns: EinzelanalyseTable["columns"]
  slotLabel: string
}

function SlotGroupRows({ group, columns, slotLabel }: SlotGroupRowsProps) {
  return (
    <>
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableCell
          colSpan={columns.length + 1}
          className="text-muted-foreground sticky left-0 z-10 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide"
        >
          {slotLabel}
        </TableCell>
      </TableRow>
      {group.rows.map((row) => (
        <TableRow key={row.entryId}>
          <TableCell className="bg-background sticky left-0 z-10 max-w-[280px] truncate font-medium">
            {row.label}
          </TableCell>
          {columns.map((column) => {
            const cell = row.cells[column.nutrientId]
            if (!cell) return <TableCell key={column.nutrientId} />
            const isTop = column.topEntryId === row.entryId && cell.absolute > 0
            return (
              <TableCell
                key={column.nutrientId}
                className={cn(
                  "text-right",
                  isTop && "bg-emerald-50/70 text-emerald-900",
                )}
              >
                <div className="leading-tight">
                  <div>{formatNumber(cell.displayValue, decimalsFor(cell.displayValue))}</div>
                  <div
                    className={cn(
                      "text-[10px]",
                      isTop ? "text-emerald-700/80" : "text-muted-foreground",
                    )}
                  >
                    {cell.percentOfTotal > 0
                      ? `${formatNumber(cell.percentOfTotal, cell.percentOfTotal < 10 ? 1 : 0)} %`
                      : "–"}
                  </div>
                </div>
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}
