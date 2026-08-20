"use client"

import { useRef, useState, type ChangeEvent } from "react"
import { FileUp, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

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
import {
  countImportedEntries,
  importedPlanSlotsToMealSlots,
  parseMealPlanExchange,
  type ImportedMealPlan,
} from "@/lib/meal-plan-exchange"
import type { MealSlot } from "@/lib/types"

interface PlanDataExchangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (slots: MealSlot[], plan: ImportedMealPlan) => void
}

export function PlanDataExchangeDialog({
  open,
  onOpenChange,
  onApply,
}: PlanDataExchangeDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [importedPlan, setImportedPlan] = useState<ImportedMealPlan | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const reset = () => {
    setImportedPlan(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportedPlan(null)
    setIsChecking(true)
    try {
      const parsedFile = parseMealPlanExchange(JSON.parse(await file.text()))
      const response = await fetch("/api/meal-plan-exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: "import", payload: parsedFile }),
      })
      const responseBody = (await response.json().catch(() => null)) as
        | { plan?: ImportedMealPlan; error?: string }
        | null
      if (!response.ok || !responseBody?.plan) {
        throw new Error(responseBody?.error ?? "Plan-Datei konnte nicht geprüft werden.")
      }
      setImportedPlan(responseBody.plan)
      toast.success("Plan-Datei geprüft. Du kannst sie jetzt als Entwurf einsetzen.")
    } catch (error) {
      console.error("Failed to import meal plan:", error)
      toast.error(error instanceof Error ? error.message : "Plan-Datei konnte nicht gelesen werden.")
    } finally {
      setIsChecking(false)
    }
  }

  const handleApply = () => {
    if (!importedPlan) return
    // Regenerate entry ids now, only after the user confirms the preview.
    onApply(importedPlanSlotsToMealSlots(importedPlan), importedPlan)
    toast.success("Importierter Plan wurde als Entwurf eingesetzt.")
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan-Datei importieren</DialogTitle>
          <DialogDescription>
            Das Inari-Format enthält nur Planinhalte. Patientendaten, Freigaben und alte Plan-IDs werden nicht
            übertragen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="font-medium">Plan-Datei prüfen</p>
            <p className="mt-1 text-sm text-muted-foreground">Nur berechtigte Rollen können einen Plan importieren. Alle Lebensmittel und Rezepte werden vor dem Einsetzen geprüft.</p>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleFileChange(event)}
            />
            <Button className="mt-3" variant="outline" onClick={() => inputRef.current?.click()} disabled={isChecking}>
              {isChecking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileUp className="mr-1.5 h-4 w-4" />}
              {isChecking ? "Datei wird geprüft" : "Plan-Datei auswählen"}
            </Button>
          </div>

          {importedPlan ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="font-medium">Plan-Datei ist geprüft</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{countImportedEntries(importedPlan)} Einträge</Badge>
                <Badge variant="secondary">{importedPlan.slots.filter((slot) => slot.entries.length > 0).length} Mahlzeiten</Badge>
                {importedPlan.title ? <Badge variant="outline">{importedPlan.title}</Badge> : null}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Der aktuelle Plan bleibt bis zum nächsten Klick unverändert. Der Import wird als neuer Entwurf für den ausgewählten Tag eingesetzt.</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Abbrechen</Button>
          <Button disabled={!importedPlan || isChecking} onClick={handleApply}>
            Als Entwurf einsetzen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
