"use client"

import { useState } from "react"

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
import { formatPlanAmount } from "@/lib/client-food-log"
import type { ClientPlanEntry, ClientPlanEntryFacts } from "@/lib/types"

function parseAmount(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * "I only had half of it."
 *
 * Kept from the two-list version, which is where it was reached by tapping the
 * amount. In the merged list it hangs off the planned row's menu — rarer than
 * ticking, but the difference between a plan followed and a plan followed
 * halfway is exactly what a counselor reads.
 */
export function ClientPlannedAmountDialog({
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
