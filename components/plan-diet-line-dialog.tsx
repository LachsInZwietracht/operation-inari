"use client"

import { useState } from "react"
import { Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions"
import type { DietLinePreset } from "@/lib/types"

type DietLineTargetDraft = DietLinePreset["targets"][number]

export interface DietLineDraft {
  /** Set when editing an existing user-owned preset; omitted for copies of system presets. */
  id?: string
  name: string
  description: string
  targets: DietLineTargetDraft[]
}

function createTargetDraft(nutrientId = "energie"): DietLineTargetDraft {
  const definition = NUTRIENT_DEFINITIONS.find((item) => item.id === nutrientId)
  return {
    nutrientId,
    label: definition?.shortName ?? definition?.name ?? nutrientId,
    unit: definition?.unit ?? "",
    min: undefined,
    max: undefined,
  }
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

interface PlanDietLineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dietLine?: DietLinePreset
  isEditable: boolean
  /** Persists the draft; resolves true on success so the dialog can close. */
  onSave: (draft: DietLineDraft) => Promise<boolean>
  onDelete: () => Promise<void>
}

/** Editor for diet-line/target-profile presets linked to the current day plan. */
export function PlanDietLineDialog({
  open,
  onOpenChange,
  dietLine,
  isEditable,
  onSave,
  onDelete,
}: PlanDietLineDialogProps) {
  const [draftName, setDraftName] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [draftTargets, setDraftTargets] = useState<DietLineTargetDraft[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Seed the drafts from the active preset each time the dialog opens.
  // System presets open as an editable copy ("… Kopie"). Seeded during
  // render (not in an effect) so the first open paint shows the values.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const baseTargets = dietLine?.targets.length
        ? dietLine.targets.map((target) => ({ ...target }))
        : [createTargetDraft("energie"), createTargetDraft("eiweiss"), createTargetDraft("kohlenhydrate")]
      setDraftName(dietLine ? (isEditable ? dietLine.name : `${dietLine.name} Kopie`) : "")
      setDraftDescription(dietLine?.description ?? "")
      setDraftTargets(baseTargets)
    }
  }

  const updateDraftTarget = (index: number, patch: Partial<DietLineTargetDraft>) => {
    setDraftTargets((prev) =>
      prev.map((target, targetIndex) => {
        if (targetIndex !== index) return target
        const next = { ...target, ...patch }
        if (patch.nutrientId) {
          const definition = NUTRIENT_DEFINITIONS.find((item) => item.id === patch.nutrientId)
          next.label = definition?.shortName ?? definition?.name ?? patch.nutrientId
          next.unit = definition?.unit ?? ""
        }
        return next
      }),
    )
  }

  const addDraftTarget = () => {
    const firstUnused = NUTRIENT_DEFINITIONS.find(
      (definition) => !draftTargets.some((target) => target.nutrientId === definition.id),
    )
    setDraftTargets((prev) => [...prev, createTargetDraft(firstUnused?.id ?? "energie")])
  }

  const removeDraftTarget = (index: number) => {
    setDraftTargets((prev) => prev.filter((_, targetIndex) => targetIndex !== index))
  }

  const saveDraft = async () => {
    const name = draftName.trim()
    const description = draftDescription.trim()
    const targets = draftTargets
      .map((target) => ({
        ...target,
        label:
          target.label.trim() ||
          (NUTRIENT_DEFINITIONS.find((item) => item.id === target.nutrientId)?.shortName ?? target.nutrientId),
      }))
      .filter((target) => target.nutrientId && (target.min != null || target.max != null))

    if (!name) {
      toast.error("Bitte einen Namen für das Zielprofil eingeben.")
      return
    }
    if (targets.length === 0) {
      toast.error("Bitte mindestens einen Zielwert mit Unter- oder Obergrenze pflegen.")
      return
    }

    setIsSaving(true)
    try {
      const saved = await onSave({
        id: isEditable ? dietLine?.id : undefined,
        name,
        description,
        targets,
      })
      if (saved) {
        onOpenChange(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Kostform/Zielprofil verwalten</DialogTitle>
          <DialogDescription>
            Eigene Vorgaben werden gespeichert und können direkt mit dem aktuellen Tagesplan verknüpft werden.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <div className="space-y-2">
              <Label htmlFor="diet-line-name">Name</Label>
              <Input
                id="diet-line-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="z. B. Dialyse 1800 kcal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="diet-line-description">Beschreibung</Label>
              <Input
                id="diet-line-description"
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                placeholder="Kurzbeschreibung für Planung und Prüfung"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nährstoff</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="w-28">Min.</TableHead>
                  <TableHead className="w-28">Max.</TableHead>
                  <TableHead className="w-20">Einheit</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Entfernen</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftTargets.map((target, index) => (
                  <TableRow key={`${target.nutrientId}-${index}`}>
                    <TableCell>
                      <Select
                        value={target.nutrientId}
                        onValueChange={(value) => updateDraftTarget(index, { nutrientId: value })}
                      >
                        <SelectTrigger className="w-[190px]">
                          <SelectValue placeholder="Nährstoff" />
                        </SelectTrigger>
                        <SelectContent>
                          {NUTRIENT_DEFINITIONS.map((definition) => (
                            <SelectItem key={definition.id} value={definition.id}>
                              {definition.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={target.label}
                        onChange={(event) => updateDraftTarget(index, { label: event.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={target.min ?? ""}
                        onChange={(event) => updateDraftTarget(index, { min: parseOptionalNumber(event.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={target.max ?? ""}
                        onChange={(event) => updateDraftTarget(index, { max: parseOptionalNumber(event.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{target.unit}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDraftTarget(index)}
                        disabled={draftTargets.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Zielwert entfernen</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button variant="outline" className="w-fit" onClick={addDraftTarget}>
            <Plus className="mr-2 h-4 w-4" />
            Zielwert hinzufügen
          </Button>
        </div>
        <DialogFooter className="items-center justify-between sm:justify-between">
          <div>
            {isEditable && (
              <Button variant="ghost" className="text-destructive" onClick={() => void onDelete()}>
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => void saveDraft()} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Speichert..." : "Speichern"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
