"use client"

import { useEffect, useMemo, useReducer, useState } from "react"
import { Check, Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { matchSmartInputMulti, type SmartMatchCandidate } from "@/lib/nlp-matching"
import { getNutrientValue } from "@/lib/nutrients"
import type {
  DigitalProtocolSubmission,
  Food,
  MealSlotType,
  ProtocolDraftPrefill,
} from "@/lib/types"

interface SmartMatchReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  submission: DigitalProtocolSubmission
  foods: Food[]
  onConfirm: (draft: ProtocolDraftPrefill) => void
}

interface ReviewEntry {
  dayIndex: number
  entryIndex: number
  freeText: string
  mealSlot: string
  time?: string
  candidates: SmartMatchCandidate[]
  selectedCandidateIndex: number // -1 = rejected
  status: "accepted" | "rejected" | "pending"
}

type ReviewAction =
  | { type: "init"; entries: ReviewEntry[] }
  | { type: "accept"; key: string }
  | { type: "reject"; key: string }
  | { type: "select_candidate"; key: string; candidateIndex: number }
  | { type: "set_food"; key: string; foodId: string; foodName: string }

function entryKey(dayIndex: number, entryIndex: number) {
  return `${dayIndex}-${entryIndex}`
}

function reviewReducer(
  state: Map<string, ReviewEntry>,
  action: ReviewAction,
): Map<string, ReviewEntry> {
  switch (action.type) {
    case "init": {
      const map = new Map<string, ReviewEntry>()
      for (const entry of action.entries) {
        map.set(entryKey(entry.dayIndex, entry.entryIndex), entry)
      }
      return map
    }
    case "accept": {
      const next = new Map(state)
      const entry = next.get(action.key)
      if (entry && entry.candidates.length > 0) {
        next.set(action.key, {
          ...entry,
          status: "accepted",
          selectedCandidateIndex: entry.selectedCandidateIndex === -1 ? 0 : entry.selectedCandidateIndex,
        })
      }
      return next
    }
    case "reject": {
      const next = new Map(state)
      const entry = next.get(action.key)
      if (entry) {
        next.set(action.key, { ...entry, status: "rejected", selectedCandidateIndex: -1 })
      }
      return next
    }
    case "select_candidate": {
      const next = new Map(state)
      const entry = next.get(action.key)
      if (entry) {
        next.set(action.key, {
          ...entry,
          status: "accepted",
          selectedCandidateIndex: action.candidateIndex,
        })
      }
      return next
    }
    case "set_food": {
      const next = new Map(state)
      const entry = next.get(action.key)
      if (entry) {
        const manualCandidate: SmartMatchCandidate = {
          foodId: action.foodId,
          foodName: action.foodName,
          amount: 100,
          confidence: 1,
          matchType: "exact",
        }
        next.set(action.key, {
          ...entry,
          status: "accepted",
          candidates: [manualCandidate, ...entry.candidates],
          selectedCandidateIndex: 0,
        })
      }
      return next
    }
    default:
      return state
  }
}

function confidenceBadgeVariant(confidence: number): "default" | "secondary" | "destructive" {
  if (confidence >= 0.8) return "default"
  if (confidence >= 0.5) return "secondary"
  return "destructive"
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  exact: "exakt",
  prefix: "Prefix",
  contains: "enthält",
  fuzzy: "ähnlich",
  phonetic: "phonetisch",
}

const VALID_MEAL_SLOTS = new Set<MealSlotType>([
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
])

function normalizeMealSlot(value: string): MealSlotType {
  if (VALID_MEAL_SLOTS.has(value as MealSlotType)) return value as MealSlotType
  return "mittagessen"
}

export function SmartMatchReviewDialog({
  open,
  onOpenChange,
  submission,
  foods,
  onConfirm,
}: SmartMatchReviewDialogProps) {
  const [state, dispatch] = useReducer(reviewReducer, new Map())
  const [foodSearchKey, setFoodSearchKey] = useState<string | null>(null)
  const [foodDialogOpen, setFoodDialogOpen] = useState(false)

  // Run matching on open
  useEffect(() => {
    if (!open) return

    const entries: ReviewEntry[] = []
    submission.days.forEach((day, dayIndex) => {
      day.entries.forEach((entry, entryIndex) => {
        if (!entry.freeText.trim()) return

        const resultSets = matchSmartInputMulti(entry.freeText, foods)
        // Take candidates from first result set (compound splitting not used in review — full text match)
        const candidates = resultSets[0]?.candidates ?? []
        const bestConfidence = candidates[0]?.confidence ?? 0

        entries.push({
          dayIndex,
          entryIndex,
          freeText: entry.freeText,
          mealSlot: entry.mealSlot,
          time: entry.time,
          candidates,
          selectedCandidateIndex: candidates.length > 0 ? 0 : -1,
          status: bestConfidence >= 0.8 ? "accepted" : "pending",
        })
      })
    })

    dispatch({ type: "init", entries })
  }, [open, submission, foods])

  const entriesByDay = useMemo(() => {
    const grouped: { date: string; entries: ReviewEntry[] }[] = []
    const allEntries = Array.from(state.values())

    submission.days.forEach((day, dayIndex) => {
      const dayEntries = allEntries
        .filter((e) => e.dayIndex === dayIndex)
        .sort((a, b) => a.entryIndex - b.entryIndex)
      if (dayEntries.length > 0) {
        grouped.push({ date: day.date, entries: dayEntries })
      }
    })

    return grouped
  }, [state, submission.days])

  const stats = useMemo(() => {
    const all = Array.from(state.values())
    return {
      total: all.length,
      accepted: all.filter((e) => e.status === "accepted").length,
      rejected: all.filter((e) => e.status === "rejected").length,
      pending: all.filter((e) => e.status === "pending").length,
    }
  }, [state])

  function handleConfirm() {
    type DraftEntry = {
      foodId: string
      amount: number
      mealSlot: MealSlotType
      time: string
      measurementMode: "grams" | "household"
      householdUnit?: string
      householdQuantity?: number
    }
    const dayMap = new Map<number, DraftEntry[]>()

    for (const entry of state.values()) {
      if (entry.status !== "accepted") continue
      const candidate = entry.candidates[entry.selectedCandidateIndex]
      if (!candidate) continue

      const mealSlot = normalizeMealSlot(entry.mealSlot)
      const draftEntry: DraftEntry = {
        foodId: candidate.foodId,
        amount: candidate.amount,
        mealSlot,
        time: entry.time ?? "",
        measurementMode: candidate.unit ? "household" : "grams",
        householdUnit: candidate.unit,
        householdQuantity: candidate.quantity,
      }

      if (!dayMap.has(entry.dayIndex)) {
        dayMap.set(entry.dayIndex, [])
      }
      dayMap.get(entry.dayIndex)!.push(draftEntry)
    }

    // Build source notes for transparency
    const sourceSections: string[] = []
    submission.days.forEach((day, dayIndex) => {
      const sourceLines: string[] = []
      day.entries.forEach((entry, entryIndex) => {
        const key = entryKey(dayIndex, entryIndex)
        const reviewEntry = state.get(key)
        const mealSlot = normalizeMealSlot(entry.mealSlot)
        const timeLabel = entry.time ? ` (${entry.time})` : ""

        if (reviewEntry?.status === "accepted" && reviewEntry.candidates[reviewEntry.selectedCandidateIndex]) {
          const candidate = reviewEntry.candidates[reviewEntry.selectedCandidateIndex]
          sourceLines.push(
            `- ${MEAL_SLOT_LABELS[mealSlot]}${timeLabel}: ${entry.freeText} -> Match: ${candidate.foodName}`,
          )
        } else {
          sourceLines.push(
            `- ${MEAL_SLOT_LABELS[mealSlot]}${timeLabel}: ${entry.freeText} -> manuell pruefen`,
          )
        }
      })
      sourceSections.push(`${day.date}\n${sourceLines.join("\n")}`)
    })

    const notesSections = [
      `Quelle: Digitales Protokoll eingereicht am ${submission.submittedAt.slice(0, 10)}.`,
    ]
    if (submission.notes?.trim()) {
      notesSections.push(`Anmerkungen des Patienten:\n${submission.notes.trim()}`)
    }
    notesSections.push(`Originaleintraege:\n${sourceSections.join("\n\n")}`)

    const draft: ProtocolDraftPrefill = {
      title: `Digitales Protokoll vom ${submission.submittedAt.slice(0, 10)}`,
      type: "ernaehrungsprotokoll",
      notes: notesSections.join("\n\n"),
      days: submission.days.map((day, dayIndex) => ({
        date: day.date,
        entries: dayMap.get(dayIndex) ?? [],
      })),
      metadata: {
        assessmentMethod: "diet_diary",
        documentedDays: submission.days.length,
        source: "digital_protocol_submission",
        sourceSubmissionId: submission.id,
      },
    }

    onConfirm(draft)
  }

  function handleManualSearch(key: string) {
    setFoodSearchKey(key)
    setFoodDialogOpen(true)
  }

  function handleFoodSelected(foodId: string) {
    if (!foodSearchKey) return
    const food = foods.find((f) => f.id === foodId)
    if (!food) return
    dispatch({ type: "set_food", key: foodSearchKey, foodId: food.id, foodName: food.name })
    setFoodDialogOpen(false)
    setFoodSearchKey(null)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Smart-Match Überprüfung</SheetTitle>
            <SheetDescription>
              Eingereicht am {submission.submittedAt.slice(0, 10)} —{" "}
              {stats.accepted} akzeptiert, {stats.pending} offen, {stats.rejected} abgelehnt
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {entriesByDay.map(({ date, entries }) => (
              <div key={date} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{date}</h3>
                {entries.map((entry) => {
                  const key = entryKey(entry.dayIndex, entry.entryIndex)
                  const mealSlot = normalizeMealSlot(entry.mealSlot)

                  return (
                    <div
                      key={key}
                      className={`rounded-lg border p-3 space-y-2 ${
                        entry.status === "rejected"
                          ? "opacity-50 border-destructive/30"
                          : entry.status === "accepted"
                            ? "border-primary/30"
                            : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{entry.freeText}</p>
                          <p className="text-xs text-muted-foreground">
                            {MEAL_SLOT_LABELS[mealSlot]}
                            {entry.time && ` · ${entry.time}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant={entry.status === "accepted" ? "default" : "outline"}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => dispatch({ type: "accept", key })}
                            disabled={entry.candidates.length === 0}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant={entry.status === "rejected" ? "destructive" : "outline"}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => dispatch({ type: "reject", key })}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleManualSearch(key)}
                          >
                            <Search className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {entry.status !== "rejected" && (
                        <div className="space-y-1">
                          {entry.candidates.map((candidate, candidateIndex) => (
                            <button
                              key={`${candidate.foodId}-${candidateIndex}`}
                              type="button"
                              className={`flex w-full items-center justify-between rounded px-2 py-1 text-sm transition-colors hover:bg-accent ${
                                entry.selectedCandidateIndex === candidateIndex
                                  ? "bg-accent ring-1 ring-ring"
                                  : ""
                              }`}
                              onClick={() =>
                                dispatch({
                                  type: "select_candidate",
                                  key,
                                  candidateIndex,
                                })
                              }
                            >
                              <span className="flex items-center gap-2">
                                {entry.selectedCandidateIndex === candidateIndex && (
                                  <Check className="h-3 w-3 text-primary" />
                                )}
                                <span>{candidate.foodName}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">
                                  {MATCH_TYPE_LABELS[candidate.matchType] ?? candidate.matchType}
                                </span>
                                <Badge
                                  variant={confidenceBadgeVariant(candidate.confidence)}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {Math.round(candidate.confidence * 100)}%
                                </Badge>
                              </span>
                            </button>
                          ))}
                          {entry.candidates.length === 0 && (
                            <p className="text-xs text-muted-foreground px-2">
                              Kein Treffer — bitte manuell suchen
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <SheetFooter className="mt-6 flex-col gap-2 sm:flex-row">
            {stats.pending > 0 && (
              <p className="text-xs text-amber-600">
                {stats.pending} Einträge noch nicht überprüft
              </p>
            )}
            <Button onClick={handleConfirm} className="w-full sm:w-auto">
              <Check className="mr-2 h-4 w-4" />
              Übernehmen ({stats.accepted} Einträge)
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <CommandDialog
        open={foodDialogOpen}
        onOpenChange={setFoodDialogOpen}
        title="Lebensmittel suchen"
        description="Wählen Sie ein Lebensmittel aus der Datenbank"
      >
        <CommandInput placeholder="Lebensmittel suchen..." />
        <CommandList>
          <CommandEmpty>Kein Lebensmittel gefunden.</CommandEmpty>
          <CommandGroup heading="Lebensmittel">
            {foods.map((food) => (
              <CommandItem
                key={food.id}
                value={food.name}
                onSelect={() => handleFoodSelected(food.id)}
              >
                <span>{food.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {getNutrientValue(food.nutrients, "energie")} kcal/100g
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
