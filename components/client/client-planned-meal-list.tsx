"use client"

import { useState } from "react"
import { Check, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  eatenAmount,
  formatPlanAmount,
  planEntryNutrients,
} from "@/lib/client-food-log"
import { getNutrientValue } from "@/lib/nutrients"
import { cn } from "@/lib/utils"
import type {
  ClientMealCompletion,
  ClientPlanEntry,
  ClientPlanEntryFacts,
} from "@/lib/types"

function parseAmount(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * The planned meals of one slot, shown inside the diary.
 *
 * They are the day's expectation drawn in before it happens. Answering one is
 * the same gesture as writing a diary line — which is the whole point: a client
 * who follows their plan should not have to type it in a second time for the
 * day to add up.
 */
export function ClientPlannedMealList({
  entries,
  facts,
  completions,
  pendingEntryId,
  onAnswer,
  onAmount,
}: {
  entries: ClientPlanEntry[]
  facts: Map<string, ClientPlanEntryFacts>
  completions: Map<string, ClientMealCompletion>
  pendingEntryId: string | null
  onAnswer: (entry: ClientPlanEntry, skipped: boolean) => void
  onAmount: (entry: ClientPlanEntry, amount: number | undefined) => void
}) {
  const [editing, setEditing] = useState<ClientPlanEntry | null>(null)

  if (entries.length === 0) return null

  return (
    <>
      <ul className="divide-y">
        {entries.map((entry) => {
          const completion = completions.get(entry.id)
          const isDone = Boolean(completion) && !completion!.skipped
          const isSkipped = completion?.skipped === true
          const isPending = pendingEntryId === entry.id

          const entryFacts = facts.get(entry.id)
          const amount = isDone ? eatenAmount(entry, completion) : entry.amount
          const kcal = Math.round(
            getNutrientValue(planEntryNutrients(entryFacts, amount), "energie"),
          )
          const unit = entryFacts?.unit ?? (entry.entryType === "recipe" ? "portion" : "g")

          return (
            <li key={entry.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm",
                    isSkipped && "text-muted-foreground line-through",
                    !isDone && !isSkipped && "text-muted-foreground",
                  )}
                >
                  {entryFacts?.label ?? (entry.entryType === "recipe" ? "Rezept" : "Lebensmittel")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isDone ? (
                    // Only an eaten entry has an amount worth correcting.
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:text-foreground"
                      onClick={() => setEditing(entry)}
                    >
                      {formatPlanAmount(amount, unit)}
                    </button>
                  ) : (
                    formatPlanAmount(amount, unit)
                  )}
                  {kcal > 0 && <span className="tabular-nums"> · {kcal} kcal</span>}
                  {!isDone && !isSkipped && <span> · geplant</span>}
                </p>
              </div>

              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
              ) : null}

              <Button
                variant={isDone ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                disabled={isPending}
                aria-label="Gegessen"
                aria-pressed={isDone}
                onClick={() => onAnswer(entry, false)}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant={isSkipped ? "secondary" : "outline"}
                size="icon"
                className="h-8 w-8"
                disabled={isPending}
                aria-label="Ausgelassen"
                aria-pressed={isSkipped}
                onClick={() => onAnswer(entry, true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          )
        })}
      </ul>

      {editing && (
        <PlannedAmountDialog
          entry={editing}
          facts={facts.get(editing.id)}
          current={eatenAmount(editing, completions.get(editing.id))}
          onClose={() => setEditing(null)}
          onSave={(amount) => {
            onAmount(editing, amount)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function PlannedAmountDialog({
  entry,
  facts,
  current,
  onClose,
  onSave,
}: {
  entry: ClientPlanEntry
  facts: ClientPlanEntryFacts | undefined
  current: number
  onClose: () => void
  onSave: (amount: number | undefined) => void
}) {
  const [value, setValue] = useState(String(current))
  const unit = facts?.unit ?? (entry.entryType === "recipe" ? "portion" : "g")

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{facts?.label ?? "Menge"}</DialogTitle>
          <DialogDescription>
            Geplant waren {formatPlanAmount(entry.amount, unit)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="planned-amount">
            {unit === "g" ? "Menge (g)" : "Portionen"}
          </Label>
          <Input
            id="planned-amount"
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {/* Back to NULL rather than to the planned number: "as planned" is a
              different statement from "coincidentally the same amount". */}
          <Button variant="outline" onClick={() => onSave(undefined)}>
            Wie geplant
          </Button>
          <Button
            onClick={() => {
              const parsed = parseAmount(value)
              if (parsed !== undefined) onSave(parsed)
            }}
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
