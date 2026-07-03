"use client"

import { format, parseISO } from "date-fns"
import { FolderOpen } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { formatNumber } from "@/lib/format"
import type { SustainabilityBreakdown } from "@/lib/sustainability"
import type { DailyMealPlan, MealPlanVersion } from "@/lib/types"

interface PlanAkteSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: DailyMealPlan
  sustainability: SustainabilityBreakdown
  versions: MealPlanVersion[]
  versionsLoading: boolean
  onSaveNotes: (notes: string) => void
  onRestoreVersion: (version: MealPlanVersion) => void
}

/** Right-hand detail sheet: plan notes, sustainability emitters, full version history. */
export function PlanAkteSheet({
  open,
  onOpenChange,
  plan,
  sustainability,
  versions,
  versionsLoading,
  onSaveNotes,
  onRestoreVersion,
}: PlanAkteSheetProps) {
  const isApproved = plan.status === "approved"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="text-primary h-4 w-4" />
            Planakte – Detailansicht
          </SheetTitle>
          <SheetDescription>
            Hinweise, Nachhaltigkeit und vollständige Versionshistorie.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="space-y-5 p-4">
            <section className="space-y-2">
              <Label
                htmlFor="planakte-notes"
                className="text-muted-foreground text-xs uppercase tracking-wide"
              >
                Hinweise
              </Label>
              <Textarea
                id="planakte-notes"
                key={`notes-${plan.id}-${plan.date}`}
                defaultValue={plan.notes ?? ""}
                placeholder="Indikation, Beratungshinweise, Patientenvorlieben oder interne Prüfnotizen"
                rows={4}
                readOnly={isApproved}
                onBlur={(event) => {
                  if (event.currentTarget.value.trim() !== (plan.notes ?? "")) {
                    onSaveNotes(event.currentTarget.value)
                  }
                }}
              />
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Nachhaltigkeit – Top-Verursacher</p>
                <Badge variant="outline" className="font-normal">
                  {formatNumber(sustainability.totalCo2, 2)} kg CO₂e
                </Badge>
              </div>
              {sustainability.topEmitters.length > 0 ? (
                <div className="space-y-1.5">
                  {sustainability.topEmitters.slice(0, 5).map((emitter) => (
                    <div
                      key={emitter.id}
                      className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {MEAL_SLOT_LABELS[emitter.slot] ?? emitter.slot}
                        </Badge>
                        <span className="truncate">{emitter.label}</span>
                      </div>
                      <span className="font-semibold">
                        {formatNumber(emitter.co2, 2)} kg
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Noch keine Daten zu Emittenten.
                </p>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Versionshistorie</p>
                <Badge variant="outline" className="font-normal">
                  {versionsLoading ? "lädt" : `${versions.length} Versionen`}
                </Badge>
              </div>
              {versions.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Noch keine freigegebene oder gespeicherte Version.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {versions.map((version) => {
                    const entryCount = version.snapshot.slots.reduce(
                      (sum, slot) => sum + slot.entries.length,
                      0,
                    )
                    return (
                      <div
                        key={version.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">
                            Version {version.versionNumber} ·{" "}
                            {format(parseISO(version.createdAt), "dd.MM.yyyy HH:mm")}
                          </p>
                          <p className="text-muted-foreground">
                            {entryCount} Einträge ·{" "}
                            {version.reason === "approved"
                              ? "Freigabe"
                              : version.reason === "manual"
                                ? "Checkpoint"
                                : "Wiederöffnung"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          disabled={isApproved}
                          onClick={() => onRestoreVersion(version)}
                        >
                          Wiederherstellen
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
              {isApproved && versions.length > 0 && (
                <p className="text-muted-foreground text-[11px]">
                  Zum Wiederherstellen zuerst den Plan als Entwurf öffnen.
                </p>
              )}
            </section>
          </div>
        </ScrollArea>
        <SheetFooter className="border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
