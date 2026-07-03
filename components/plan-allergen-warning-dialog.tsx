"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AllergenWarning } from "@/lib/allergen-warnings"
import {
  ALLERGEN_SEVERITY_LABELS,
  ALLERGEN_TYPE_LABELS,
} from "@/lib/allergen-constants"

interface PlanAllergenWarningDialogProps {
  open: boolean
  itemName?: string
  warnings: AllergenWarning[]
  onConfirm: () => void
  onDismiss: () => void
}

/** Blocking confirmation shown before a severely conflicting item enters the plan. */
export function PlanAllergenWarningDialog({
  open,
  itemName,
  warnings,
  onConfirm,
  onDismiss,
}: PlanAllergenWarningDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onDismiss()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-red-700">
            Schwere Allergenwarnung – Eintrag blockiert
          </DialogTitle>
          <DialogDescription>
            {itemName
              ? `${itemName} kollidiert mit einem als „schwer“ eingestuften Allergen-/Intoleranzhinweis dieses Patienten.`
              : null}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <div className="space-y-3 text-sm">
            <ul className="space-y-1">
              {warnings.map((warning) => (
                <li
                  key={warning.allergenId}
                  className="flex flex-wrap items-center gap-2"
                >
                  <Badge
                    variant="outline"
                    className={
                      warning.severity === "severe"
                        ? "border-red-300 bg-red-100 text-red-800"
                        : warning.severity === "moderate"
                          ? "border-amber-300 bg-amber-100 text-amber-800"
                          : "border-yellow-300 bg-yellow-100 text-yellow-800"
                    }
                  >
                    {ALLERGEN_SEVERITY_LABELS[warning.severity]}
                  </Badge>
                  <span className="font-medium">{warning.allergenLabel}</span>
                  <span className="text-muted-foreground text-xs">
                    {ALLERGEN_TYPE_LABELS[warning.type]} · Treffer: {warning.matchedToken}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">
              Bitte vor der Übernahme die klinische Indikation und alternative Lebensmittel
              prüfen. Eine Übernahme wird im Plan und in der nächsten Versionsspeicherung
              dokumentiert.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onDismiss}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Trotzdem übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
