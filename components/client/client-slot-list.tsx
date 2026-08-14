"use client"

import { Check, Loader2, MoreHorizontal, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatPlanAmount } from "@/lib/client-food-log"
import { cn } from "@/lib/utils"
import type { ClientSlotRow } from "@/lib/client-slot-rows"

/**
 * One slot, one list.
 *
 * The plan used to sit in its own list above the diary, which read like
 * homework stapled to a journal. Here the planned meals are simply drawn into
 * the day before it happens, greyed out, and answering one is a tap. A row
 * that is still grey in the evening has answered the question by itself.
 *
 * Replacing is deliberate rather than inferred. Logging something does not
 * silently consume a planned row — there is no rule that could pick which of
 * two planned items a third thing replaced, and guessing wrong destroys the
 * only signal the plan exists to produce. "Anders gegessen" says it outright,
 * and everything logged through the normal button is an addition.
 */
export function ClientSlotList({
  rows,
  pendingId,
  onEat,
  onSkip,
  onReplace,
  onChangeAmount,
  onOpenEntry,
  onDeleteEntry,
}: {
  rows: ClientSlotRow[]
  pendingId: string | null
  onEat: (row: ClientSlotRow) => void
  onSkip: (row: ClientSlotRow) => void
  onReplace: (row: ClientSlotRow) => void
  onChangeAmount: (row: ClientSlotRow) => void
  onOpenEntry: (row: ClientSlotRow) => void
  onDeleteEntry: (row: ClientSlotRow) => void
}) {
  if (rows.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">Noch nichts eingetragen.</p>
  }

  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-2 py-2">
          {row.kind === "planned" ? (
            <>
              {/* The fast path: one tap says you ate what was planned. */}
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                aria-pressed={row.isEaten}
                disabled={pendingId === row.planEntryId}
                onClick={() => onEat(row)}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    row.isEaten
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40",
                  )}
                >
                  {pendingId === row.planEntryId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : row.isEaten ? (
                    <Check className="h-3 w-3" />
                  ) : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm",
                      // Grey until answered: the plan is a suggestion drawn
                      // into the day, not a thing that happened.
                      row.isEaten ? "" : "text-muted-foreground",
                      row.isSkipped && "line-through",
                    )}
                  >
                    {row.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatPlanAmount(row.amount, row.unit)}
                    {row.kcal !== undefined && ` · ${row.kcal} kcal`}
                    {row.isSkipped && " · nicht gegessen"}
                  </span>
                </span>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`${row.label}: mehr`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Only once it was eaten: correcting the portion of
                      something you did not have is a question about nothing. */}
                  {row.isEaten && (
                    <DropdownMenuItem onClick={() => onChangeAmount(row)}>
                      Menge anpassen
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onReplace(row)}>
                    Anders gegessen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSkip(row)}>
                    {row.isSkipped ? "Doch offen lassen" : "Nicht gegessen"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onOpenEntry(row)}
              >
                <span className="block truncate text-sm">{row.label}</span>
                <span className="text-xs text-muted-foreground">
                  {/* A replacement says what it stands in for — otherwise the
                      line reads as an extra meal rather than a substitution. */}
                  {row.replacesLabel && (
                    <span className="italic">statt {row.replacesLabel} · </span>
                  )}
                  <span className="underline underline-offset-2">
                    {formatPlanAmount(row.amount, row.unit)}
                  </span>
                  {row.kcal !== undefined && ` · ${row.kcal} kcal`}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Eintrag löschen"
                onClick={() => onDeleteEntry(row)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
