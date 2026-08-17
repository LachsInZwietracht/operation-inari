"use client"

import dynamic from "next/dynamic"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AnthropometricEntry } from "@/lib/types"

// Sixteen fields worth of form is not needed until the dialog opens.
const AnthropometricForm = dynamic(
  () => import("@/components/anthropometric-form").then((mod) => mod.AnthropometricForm),
  {
    ssr: false,
    loading: () => <div className="h-64 rounded-md bg-muted/40" />,
  },
)

/** Per-patient, so one patient's unsaved input can never open in another's record. */
export function measurementDraftKey(patientId: string): string {
  return `inari:anthro-draft:${patientId}`
}

interface MeasurementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  /** Carried over from the last measurement, since height rarely changes. */
  defaultHeight?: number
  onSubmit: (entry: Omit<AnthropometricEntry, "id" | "createdAt" | "updatedAt">) => void
}

/**
 * Records a measurement without leaving the page you were reading.
 *
 * Recording used to jump to the Anthropometrie tab, which lost the overview a
 * practitioner opened the record for. Closing the dialog keeps whatever was
 * typed — see the draft handling in `AnthropometricForm`.
 */
export function MeasurementDialog({
  open,
  onOpenChange,
  patientId,
  defaultHeight,
  onSubmit,
}: MeasurementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] max-w-3xl overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Messwerte erfassen</DialogTitle>
          <DialogDescription>
            Gewicht und Größe genügen. Beim Schließen bleiben nicht gespeicherte Eingaben als
            Entwurf erhalten.
          </DialogDescription>
        </DialogHeader>
        {/* Mounting only while open is what makes the draft reload on reopen. */}
        {open ? (
          <AnthropometricForm
            patientId={patientId}
            defaultHeight={defaultHeight}
            draftKey={measurementDraftKey(patientId)}
            onSubmit={(entry) => {
              onSubmit(entry)
              onOpenChange(false)
            }}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
