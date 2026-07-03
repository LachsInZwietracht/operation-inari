"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface PlanAssignPatientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientName?: string
  patientIndications: string[]
  entryCount: number
  dateLabel: string
  isApproved: boolean
  onOpenPlanOnly: () => void
  onAssign: () => void
  onCancel: () => void
}

/** Asks whether a filled, unassigned day plan should be attached to the chosen patient. */
export function PlanAssignPatientDialog({
  open,
  onOpenChange,
  patientName,
  patientIndications,
  entryCount,
  dateLabel,
  isApproved,
  onOpenPlanOnly,
  onAssign,
  onCancel,
}: PlanAssignPatientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan einem Patienten zuordnen?</DialogTitle>
          <DialogDescription>
            Der aktuelle Tagesplan enthält bereits Einträge. Wählen Sie, ob dieser Plan dem
            Patienten zugeordnet oder nur der Patientenplan für diesen Tag geöffnet werden soll.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{patientName ?? "Ausgewählter Patient"}</p>
          {patientIndications.length ? (
            <p className="text-muted-foreground">{patientIndications.join(" · ")}</p>
          ) : null}
          <p className="text-muted-foreground mt-2">
            {entryCount} Einträge · {dateLabel}
          </p>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={onOpenPlanOnly}>
            Nur Patientenplan öffnen
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={onCancel}>
              Abbrechen
            </Button>
            <Button onClick={onAssign} disabled={isApproved}>
              Diesen Plan zuordnen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
