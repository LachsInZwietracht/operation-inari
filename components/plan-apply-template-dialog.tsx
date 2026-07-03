"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { DietLinePreset, MealPlanTemplate } from "@/lib/types"

type TemplateScope = "alle" | "indikation" | "kostform"

interface PlanApplyTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: MealPlanTemplate[]
  templatesLoading: boolean
  dietLines: DietLinePreset[]
  /** Diet line linked to the current day plan; enables the Kostform filter. */
  dietLine?: DietLinePreset
  dietLineId: string
  patientIndications: string[]
  onApply: (template: MealPlanTemplate) => void
}

/** Template picker that replaces the current day plan with the chosen template. */
export function PlanApplyTemplateDialog({
  open,
  onOpenChange,
  templates,
  templatesLoading,
  dietLines,
  dietLine,
  dietLineId,
  patientIndications,
  onApply,
}: PlanApplyTemplateDialogProps) {
  const [search, setSearch] = useState("")
  const [scope, setScope] = useState<TemplateScope>("alle")

  // Reset filters each time the dialog opens; default to the indication
  // filter when the patient has one. Seeded during render (not in an
  // effect) so the first open paint already shows the right filters.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSearch("")
      setScope(patientIndications.length ? "indikation" : "alle")
    }
  }

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase()
    const patientIndicationsLower = patientIndications.map((indication) => indication.toLowerCase())
    return templates.filter((template) => {
      if (scope === "indikation" && patientIndicationsLower.length > 0) {
        const templateIndication = template.indication?.toLowerCase()
        if (!templateIndication || !patientIndicationsLower.includes(templateIndication)) {
          return false
        }
      }
      if (scope === "kostform" && dietLineId) {
        if (template.dietLineId !== dietLineId) {
          return false
        }
      }
      if (!query) return true
      const haystack = [
        template.name,
        template.description ?? "",
        template.indication ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [scope, search, dietLineId, templates, patientIndications])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Plan aus Vorlage erzeugen</DialogTitle>
          <DialogDescription>
            Die ausgewählte Vorlage ersetzt den aktuellen Tagesplan. Status und Freigabe werden zurückgesetzt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Vorlagen durchsuchen..."
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={scope === "alle" ? "default" : "outline"}
                onClick={() => setScope("alle")}
              >
                Alle
              </Button>
              {patientIndications.length ? (
                <Button
                  size="sm"
                  variant={scope === "indikation" ? "default" : "outline"}
                  onClick={() => setScope("indikation")}
                >
                  {patientIndications.length === 1
                    ? patientIndications[0]
                    : `Indikationen (${patientIndications.length})`}
                </Button>
              ) : null}
              {dietLine && (
                <Button
                  size="sm"
                  variant={scope === "kostform" ? "default" : "outline"}
                  onClick={() => setScope("kostform")}
                >
                  {dietLine.name}
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="h-[360px] rounded-md border">
            {templatesLoading && filteredTemplates.length === 0 ? (
              <div className="text-muted-foreground p-4 text-sm">Vorlagen werden geladen …</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-muted-foreground p-4 text-sm">
                Keine Vorlagen für die aktuelle Filterauswahl.
              </div>
            ) : (
              <ul className="divide-y">
                {filteredTemplates.map((template) => {
                  const entryCount = template.slots.reduce(
                    (sum, slot) => sum + slot.entries.length,
                    0,
                  )
                  const dietLineForTemplate = dietLines.find(
                    (line) => line.id === template.dietLineId,
                  )
                  return (
                    <li key={template.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                      <div className="min-w-[220px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{template.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {template.sourceType === "system" ? "System" : "Eigene"}
                          </Badge>
                          {template.indication && (
                            <Badge variant="secondary" className="text-[10px]">
                              {template.indication}
                            </Badge>
                          )}
                          {dietLineForTemplate && (
                            <Badge variant="outline" className="text-[10px]">
                              {dietLineForTemplate.name}
                            </Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-muted-foreground mt-1 text-xs">{template.description}</p>
                        )}
                        <p className="text-muted-foreground mt-1 text-xs">
                          {entryCount} {entryCount === 1 ? "Eintrag" : "Einträge"} über alle Mahlzeiten
                        </p>
                      </div>
                      <Button size="sm" onClick={() => onApply(template)}>
                        Übernehmen
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
