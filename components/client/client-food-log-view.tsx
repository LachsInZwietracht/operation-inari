"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { addDays, format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { ClientAddEntryDialog } from "@/components/client/client-add-entry-dialog"
import { ClientCheckinCard } from "@/components/client/client-checkin-card"
import { ClientDayContext } from "@/components/client/client-day-context"
import { ClientDaySummary } from "@/components/client/client-day-summary"
import {
  ClientEntryDetail,
  parseEntryAmount,
} from "@/components/client/client-entry-detail"
import { ClientDayTotals } from "@/components/client/client-day-totals"
import { ClientPlannedAmountDialog } from "@/components/client/client-planned-amount-dialog"
import { ClientSlotList } from "@/components/client/client-slot-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import {
  calculatePlannedNutrients,
  clientLogEntryLabel,
  collectClientDayParts,
  collectRecentEntries,
  eatenAmount,
} from "@/lib/client-food-log"
import {
  micronutrientDataShare,
  nutrientCoverage,
  summarizeMicronutrients,
} from "@/lib/client-micronutrients"
import { scaleNutrients, sumNutrients } from "@/lib/nutrients"
import { summarizeDay } from "@/lib/client-day-summary"
import { buildSlotRows } from "@/lib/client-slot-rows"
import { resolveClientDayTarget } from "@/lib/client-targets"
import { isClientCapabilityEnabled, isClientModuleEnabled } from "@/lib/client-modules"
import { todayIsoDate } from "@/lib/client-mode"
import {
  deleteClientFoodLogEntry,
  ensureClientFoodLogDay,
  fetchClientFoodLogDay,
  fetchClientFoodLogDays,
  updateClientFoodLogDay,
  fetchFoodPortions,
  updateClientFoodLogEntryAmount,
} from "@/lib/data/client-food-log-client"
import {
  fetchClientPlanFacts,
  fetchClientRecipeFacts,
} from "@/lib/data/client-plan-nutrition-client"
import { hydrateClientFoods } from "@/lib/data/client-custom-foods-client"
import {
  fetchClientSavedMeals,
  saveClientMeal,
} from "@/lib/data/client-saved-meals-client"
import {
  clearClientMealCompletion,
  fetchClientMealCompletions,
  setClientMealCompletion,
} from "@/lib/data/client-plan-client"
import { fetchClientPatientHistory } from "@/lib/data/client-history-client"
import type {
  ClientFoodLogDay,
  ClientFoodLogEntry,
  ClientMealCompletion,
  ClientSavedMeal,
  ClientPlanDay,
  ClientPlanEntry,
  ClientPlanEntryFacts,
  Food,
  MealSlotType,
  NutrientValue,
} from "@/lib/types"
import type { ClientEnergyReference } from "@/lib/client-targets"

const SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

/** Long enough for a habit to show, short enough to stay one query. */
const SUGGESTION_WINDOW_DAYS = 14

export function ClientFoodLogView({
  date,
  clientUserId,
  initialDay,
  plan,
}: {
  date: string
  clientUserId: string | null
  initialDay: ClientFoodLogDay | null
  /** The plan for this date, when the plan module is on and one was shared. */
  plan: ClientPlanDay | null
}) {
  // The page keys this component by date, so a day switch remounts it and the
  // initial day never needs syncing back into state.
  const [day, setDay] = useState<ClientFoodLogDay | null>(initialDay)
  const [foods, setFoods] = useState<Map<string, Food>>(new Map())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [addSlot, setAddSlot] = useState<{
    slot: MealSlotType
    /** Set when the dialog was opened from a planned row's "anders gegessen". */
    replaces?: { id: string; label: string }
  } | null>(null)

  const [planFacts, setPlanFacts] = useState<Map<string, ClientPlanEntryFacts>>(new Map())
  const [completions, setCompletions] = useState<Map<string, ClientMealCompletion>>(new Map())
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null)
  const [energy, setEnergy] = useState<ClientEnergyReference | null>(null)
  const [references, setReferences] = useState<Map<string, number>>(new Map())
  const [latestWeight, setLatestWeight] = useState<{ date: string; weight: number } | null>(null)
  const [recentDays, setRecentDays] = useState<ClientFoodLogDay[]>([])
  const [savedMeals, setSavedMeals] = useState<ClientSavedMeal[]>([])
  const [recipeFacts, setRecipeFacts] = useState<
    Map<string, { name: string; perPortion: NutrientValue[] }>
  >(new Map())
  const [editingEntry, setEditingEntry] = useState<ClientFoodLogEntry | null>(null)
  const [editingPlanEntry, setEditingPlanEntry] = useState<ClientPlanEntry | null>(null)

  const planEnabled = isClientModuleEnabled("plan")
  const planEntries = useMemo(
    () => (planEnabled ? (plan?.entries ?? []) : []),
    [planEnabled, plan],
  )

  // Nutrients for logged catalog foods; custom entries carry their own.
  // The recent days are hydrated too, not just today: without them every row
  // in the "Zuletzt" list would read "Lebensmittel" with no energy, because
  // nothing eaten last Tuesday is in today's food map.
  useEffect(() => {
    const missing = [...(day?.entries ?? []), ...recentDays.flatMap((row) => row.entries)]
      .map((entry) => entry.foodId)
      .filter((foodId): foodId is string => Boolean(foodId) && !foods.has(foodId as string))

    if (missing.length === 0) return

    let cancelled = false
    // Own products are read through RLS and merged in — the by-ids endpoint
    // strips custom rows, so they would otherwise arrive nameless and free.
    void hydrateClientFoods([...new Set(missing)]).then((loaded) => {
      if (cancelled || loaded.size === 0) return
      setFoods((prev) => {
        const next = new Map(prev)
        for (const [id, food] of loaded) next.set(id, food)
        return next
      })
    })

    return () => {
      cancelled = true
    }
  }, [day, recentDays, foods])

  // What the plan costs. Resolved once per day; a plan entry the client ticks
  // off has to be priced before it can join the totals.
  useEffect(() => {
    if (!plan || planEntries.length === 0) return
    let cancelled = false

    void fetchClientPlanFacts([plan])
      .then((facts) => {
        if (!cancelled) setPlanFacts(facts)
      })
      .catch((error) => console.error("Failed to resolve plan nutrition:", error))

    return () => {
      cancelled = true
    }
  }, [plan, planEntries])

  useEffect(() => {
    if (!plan || !clientUserId) return
    let cancelled = false

    void fetchClientMealCompletions(clientUserId, plan.id)
      .then((rows) => {
        if (!cancelled) setCompletions(new Map(rows.map((row) => [row.mealEntryId, row])))
      })
      .catch((error) => console.error("Failed to load meal completions:", error))

    return () => {
      cancelled = true
    }
  }, [plan, clientUserId])

  // The counselor's energy target, used only when the day has no plan of its
  // own. Best effort: a client without a counselor keeps a diary that simply
  // shows no reference rather than one invented for them.
  useEffect(() => {
    if (!clientUserId) return
    let cancelled = false

    void fetchClientPatientHistory()
      .then((history) => {
        if (cancelled) return
        setEnergy(history.energy)
        setReferences(history.references)
        // The measurement list is ordered oldest first; the field shows the
        // last one, whoever recorded it.
        const last = history.measurements[history.measurements.length - 1]
        if (last) setLatestWeight({ date: last.date, weight: last.weight })
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [clientUserId])

  // Two weeks of history, for the two shortcuts that matter: what this person
  // usually eats in a given slot, and what they ate yesterday.
  useEffect(() => {
    if (!clientUserId) return
    let cancelled = false

    const from = format(addDays(parseISO(date), -SUGGESTION_WINDOW_DAYS), "yyyy-MM-dd")
    void fetchClientFoodLogDays(clientUserId, { from, to: date })
      .then((days) => {
        if (!cancelled) setRecentDays(days)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [clientUserId, date])

  useEffect(() => {
    if (!clientUserId) return
    let cancelled = false

    void fetchClientSavedMeals()
      .then((meals) => {
        if (!cancelled) setSavedMeals(meals)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [clientUserId])

  // Recipes logged straight into the diary need pricing, exactly like planned
  // ones — the row points at the recipe, not at a copy of its numbers.
  const loggedRecipeIds = useMemo(
    () =>
      [
        ...new Set(
          // The recent days are included for the same reason as the foods: a
          // recipe from last week has to be nameable in the "Zuletzt" list.
          [...(day?.entries ?? []), ...recentDays.flatMap((row) => row.entries)]
            .map((entry) => entry.recipeId)
            .filter((id): id is string => Boolean(id)),
        ),
      ].sort(),
    [day, recentDays],
  )
  const recipeIdKey = loggedRecipeIds.join(",")

  useEffect(() => {
    if (recipeIdKey === "") return
    let cancelled = false

    void fetchClientRecipeFacts(recipeIdKey.split(","))
      .then((facts) => {
        if (!cancelled) setRecipeFacts(facts)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [recipeIdKey])

  const refreshDay = useCallback(async () => {
    if (!clientUserId) return
    setIsRefreshing(true)
    try {
      setDay(await fetchClientFoodLogDay(clientUserId, date))
    } catch (error) {
      console.error("Failed to refresh food log day:", error)
      toast.error("Der Tag konnte nicht neu geladen werden.")
    } finally {
      setIsRefreshing(false)
    }
  }, [clientUserId, date])

  const recipePerPortion = useMemo(
    () => new Map([...recipeFacts].map(([id, facts]) => [id, facts.perPortion])),
    [recipeFacts],
  )

  // The day as a whole: what was typed in plus what was ticked off the plan.
  // Kept as parts rather than a sum, because the micronutrient panel needs to
  // know which sources carried data for what — a distinction the sum erases.
  const dayParts = useMemo(
    () =>
      collectClientDayParts({
        entries: day?.entries ?? [],
        foods,
        recipeFacts: recipePerPortion,
        planEntries,
        completions,
        planFacts,
      }),
    [day, foods, recipePerPortion, planEntries, completions, planFacts],
  )

  const totals = useMemo(() => sumNutrients(dayParts), [dayParts])

  const microDataShare = useMemo(() => micronutrientDataShare(dayParts), [dayParts])

  const micronutrients = useMemo(
    () =>
      summarizeMicronutrients({
        totals,
        references,
        coverage: nutrientCoverage(dayParts),
      }),
    [totals, references, dayParts],
  )

  // The day's own prescription outranks a standing target: it is the most
  // specific answer anyone has given to "what should today look like".
  const target = useMemo(
    () =>
      resolveClientDayTarget({
        plannedNutrients: calculatePlannedNutrients(planEntries, planFacts),
        energy,
      }),
    [planEntries, planFacts, energy],
  )

  const highlights = useMemo(
    () =>
      summarizeDay({
        totals,
        target,
        micronutrients,
        waterMl: day?.waterMl,
        plan:
          planEntries.length > 0
            ? {
                planned: planEntries.length,
                eaten: planEntries.filter((entry) => {
                  const completion = completions.get(entry.id)
                  return completion !== undefined && !completion.skipped
                }).length,
              }
            : undefined,
        entryCount: (day?.entries ?? []).length,
        isPast: date < todayIsoDate(),
      }),
    [totals, target, micronutrients, day, planEntries, completions, date],
  )

  const recipeNames = useMemo(
    () => new Map([...recipeFacts].map(([id, facts]) => [id, facts.name])),
    [recipeFacts],
  )

  const entriesBySlot = useMemo(() => {
    const grouped = new Map<MealSlotType, ClientFoodLogDay["entries"]>()
    for (const slot of SLOT_ORDER) grouped.set(slot, [])
    for (const entry of day?.entries ?? []) {
      grouped.get(entry.slotType)?.push(entry)
    }
    return grouped
  }, [day])

  const plannedBySlot = useMemo(() => {
    const grouped = new Map<MealSlotType, ClientPlanEntry[]>()
    for (const slot of SLOT_ORDER) grouped.set(slot, [])
    for (const entry of planEntries) grouped.get(entry.slotType)?.push(entry)
    return grouped
  }, [planEntries])

  const answerPlanEntry = useCallback(
    async (entry: ClientPlanEntry, skipped: boolean) => {
      if (!plan) return
      const current = completions.get(entry.id)
      setPendingEntryId(entry.id)

      try {
        // Tapping the active answer again clears it, back to no reaction.
        if (current && current.skipped === skipped) {
          await clearClientMealCompletion(entry.id)
          setCompletions((prev) => {
            const next = new Map(prev)
            next.delete(entry.id)
            return next
          })
          return
        }

        const saved = await setClientMealCompletion({
          mealPlanId: plan.id,
          mealEntryId: entry.id,
          skipped,
          // Switching from eaten to skipped drops any corrected amount with it.
          amount: skipped ? undefined : current?.amount,
        })
        setCompletions((prev) => new Map(prev).set(entry.id, saved))
      } catch (error) {
        console.error("Failed to save meal completion:", error)
        toast.error("Konnte nicht gespeichert werden.")
      } finally {
        setPendingEntryId(null)
      }
    },
    [plan, completions],
  )

  const setPlanEntryAmount = useCallback(
    async (entry: ClientPlanEntry, amount: number | undefined) => {
      if (!plan) return
      setPendingEntryId(entry.id)
      try {
        const saved = await setClientMealCompletion({
          mealPlanId: plan.id,
          mealEntryId: entry.id,
          skipped: false,
          amount,
        })
        setCompletions((prev) => new Map(prev).set(entry.id, saved))
      } catch (error) {
        console.error("Failed to save eaten amount:", error)
        toast.error("Konnte nicht gespeichert werden.")
      } finally {
        setPendingEntryId(null)
      }
    },
    [plan],
  )

  const saveEntryAmount = useCallback(
    async (entry: ClientFoodLogEntry, amount: number) => {
      try {
        await updateClientFoodLogEntryAmount(entry.id, amount)
        setDay((prev) =>
          prev
            ? {
                ...prev,
                entries: prev.entries.map((row) =>
                  row.id === entry.id ? { ...row, amount } : row,
                ),
              }
            : prev,
        )
      } catch (error) {
        console.error("Failed to update entry amount:", error)
        toast.error("Die Menge konnte nicht geändert werden.")
      }
    },
    [],
  )

  /** Water and the day's note both write to the day row, creating it if needed. */
  const patchDay = useCallback(
    async (patch: { notes?: string; waterMl?: number }) => {
      try {
        const resolvedDayId = day?.id ?? (await ensureClientFoodLogDay(date)).id
        await updateClientFoodLogDay(resolvedDayId, patch)
        setDay((prev) =>
          prev
            ? { ...prev, ...patch, id: resolvedDayId }
            : { id: resolvedDayId, date, entries: [], ...patch },
        )
      } catch (error) {
        console.error("Failed to update the day:", error)
        toast.error("Konnte nicht gespeichert werden.")
      }
    },
    [day, date],
  )

  /** Saves a filled slot under a name, so tomorrow it is one tap. */
  const saveSlotAsMeal = useCallback(
    async (slot: MealSlotType, entries: ClientFoodLogEntry[]) => {
      const suggested = MEAL_SLOT_LABELS[slot]
      const name = window.prompt("Name der Mahlzeit", suggested)?.trim()
      if (!name) return

      try {
        const meal = await saveClientMeal({
          name,
          // Recipe entries are left out: a saved meal is a set of foods, and a
          // recipe inside one would need a unit this shape does not carry.
          items: entries
            .filter((entry) => entry.sourceType !== "recipe")
            .map((entry) => ({
              sourceType: entry.sourceType,
              foodId: entry.foodId,
              customName: entry.customName,
              customNutrients: entry.customNutrients,
              amount: entry.amount,
            })),
        })
        setSavedMeals((prev) => [...prev.filter((row) => row.id !== meal.id), meal])
        toast.success(`„${meal.name}" gespeichert.`)
      } catch (error) {
        console.error("Failed to save the meal:", error)
        toast.error("Die Mahlzeit konnte nicht gespeichert werden.")
      }
    },
    [],
  )

  async function handleDelete(entryId: string) {
    try {
      await deleteClientFoodLogEntry(entryId)
      setDay((prev) =>
        prev ? { ...prev, entries: prev.entries.filter((entry) => entry.id !== entryId) } : prev,
      )
    } catch (error) {
      console.error("Failed to delete food log entry:", error)
      toast.error("Der Eintrag konnte nicht gelöscht werden.")
    }
  }

  if (!clientUserId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Anmeldung erforderlich</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Melde dich an, um dein Ernährungstagebuch zu führen.
        </CardContent>
      </Card>
    )
  }

  const parsedDate = parseISO(date)
  const today = todayIsoDate()
  const previousDate = format(addDays(parsedDate, -1), "yyyy-MM-dd")
  const nextDate = format(addDays(parsedDate, 1), "yyyy-MM-dd")
  const isToday = date === today

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/klient?datum=${previousDate}`} aria-label="Vorheriger Tag">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>

        <div className="text-center">
          <p className="text-base font-semibold">
            {isToday ? "Heute" : format(parsedDate, "EEEE", { locale: de })}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(parsedDate, "d. MMMM yyyy", { locale: de })}
          </p>
        </div>

        {date >= today ? (
          // No forward navigation past today — a diary is filled, not planned.
          <Button variant="ghost" size="icon" disabled aria-label="Nächster Tag">
            <ChevronRight className="h-5 w-5" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/klient?datum=${nextDate}`} aria-label="Nächster Tag">
              <ChevronRight className="h-5 w-5" />
            </Link>
          </Button>
        )}
      </div>

      {/* Above the totals, not below them: someone who reads their kcal balance
          first ends up rating the balance instead of the day. */}
      {isClientCapabilityEnabled("befinden") && <ClientCheckinCard date={date} />}

      <ClientDayTotals
        totals={totals}
        target={target}
        micronutrients={micronutrients}
        microDataShare={microDataShare}
      />

      {SLOT_ORDER.map((slot) => {
        const entries = entriesBySlot.get(slot) ?? []
        const planned = plannedBySlot.get(slot) ?? []

        return (
          <Card key={slot}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{MEAL_SLOT_LABELS[slot]}</CardTitle>
              <div className="flex items-center">
                {entries.some((entry) => entry.sourceType !== "recipe") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Als Mahlzeit speichern"
                    onClick={() => void saveSlotAsMeal(slot, entries)}
                  >
                    <BookmarkPlus className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setAddSlot({ slot })}>
                  <Plus className="mr-1 h-4 w-4" />
                  Hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ClientSlotList
              rows={buildSlotRows({
                planEntries: planned,
                planFacts,
                completions,
                entries,
                foods,
                recipeFacts: recipePerPortion,
                recipeNames,
              })}
              pendingId={pendingEntryId}
              onEat={(row) => {
                if (row.kind !== "planned") return
                const entry = planned.find((item) => item.id === row.planEntryId)
                if (entry) void answerPlanEntry(entry, false)
              }}
              onSkip={(row) => {
                if (row.kind !== "planned") return
                const entry = planned.find((item) => item.id === row.planEntryId)
                if (entry) void answerPlanEntry(entry, true)
              }}
              onChangeAmount={(row) => {
                if (row.kind !== "planned") return
                const entry = planned.find((item) => item.id === row.planEntryId)
                if (entry) setEditingPlanEntry(entry)
              }}
              onReplace={(row) => {
                if (row.kind !== "planned") return
                setAddSlot({ slot, replaces: { id: row.planEntryId, label: row.label } })
              }}
              onOpenEntry={(row) => {
                if (row.kind === "logged") setEditingEntry(row.entry)
              }}
              onDeleteEntry={(row) => {
                if (row.kind === "logged") void handleDelete(row.entry.id)
              }}
            />
            </CardContent>
          </Card>
        )
      })}

      {/* After the meals, not before them: the note is written when the day is
          over, and water is a running tally rather than a headline. */}
      <ClientDayContext
        date={date}
        waterMl={day?.waterMl}
        notes={day?.notes}
        weightKg={latestWeight?.weight}
        weightMeasuredOn={latestWeight?.date}
        onWaterChange={(waterMl) => void patchDay({ waterMl })}
        onNotesChange={(notes) => void patchDay({ notes })}
        onWeightRecorded={(entry) =>
          setLatestWeight({ date: entry.date, weight: entry.weight })
        }
      />

      <ClientDaySummary highlights={highlights} />

      {isRefreshing && (
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Wird aktualisiert
        </p>
      )}

      {/* Mounted per open so the dialog always starts from a clean state. */}
      {addSlot !== null && (
        <ClientAddEntryDialog
          slot={addSlot.slot}
          replaces={addSlot.replaces}
          date={date}
          dayId={day?.id ?? null}
          recent={collectRecentEntries(recentDays, addSlot.slot)}
          foods={foods}
          recipeFacts={recipePerPortion}
          recipeNames={recipeNames}
          references={references}
          savedMeals={savedMeals}
          onClose={() => setAddSlot(null)}
          onSaved={() => {
            const replaced = addSlot.replaces
            setAddSlot(null)
            // A swap answers the plan row as well: the entry says what was
            // eaten, the completion keeps adherence arithmetic unchanged.
            if (replaced) {
              const entry = planEntries.find((item) => item.id === replaced.id)
              if (entry) void answerPlanEntry(entry, true)
            }
            void refreshDay()
          }}
        />
      )}

      {editingPlanEntry && (
        <ClientPlannedAmountDialog
          entry={editingPlanEntry}
          facts={planFacts.get(editingPlanEntry.id)}
          current={eatenAmount(editingPlanEntry, completions.get(editingPlanEntry.id))}
          onClose={() => setEditingPlanEntry(null)}
          onSave={(amount: number | undefined) => {
            void setPlanEntryAmount(editingPlanEntry, amount)
            setEditingPlanEntry(null)
          }}
        />
      )}

      {editingEntry && (
        <ClientEditEntryDialog
          entry={editingEntry}
          label={clientLogEntryLabel(editingEntry, foods, recipeNames)}
          foods={foods}
          recipeFacts={recipePerPortion}
          references={references}
          onClose={() => setEditingEntry(null)}
          onSave={(amount) => {
            void saveEntryAmount(editingEntry, amount)
            setEditingEntry(null)
          }}
          onDelete={() => {
            void handleDelete(editingEntry.id)
            setEditingEntry(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * An entry already written down, opened again in full.
 *
 * This used to be a bare number field. Correcting a portion without seeing what
 * the correction does is guesswork, and the same card that helped decide the
 * amount in the first place is the one that helps fix it — including the
 * portion chips, which are usually the reason the number was wrong.
 */
function ClientEditEntryDialog({
  entry,
  label,
  foods,
  recipeFacts,
  references,
  onClose,
  onSave,
  onDelete,
}: {
  entry: ClientFoodLogEntry
  label: string
  foods: Map<string, Food>
  recipeFacts: Map<string, NutrientValue[]>
  references: Map<string, number>
  onClose: () => void
  onSave: (amount: number) => void
  onDelete: () => void
}) {
  const [value, setValue] = useState(String(entry.amount))
  const [portions, setPortions] = useState<{ label: string; amountGrams: number }[]>([])

  useEffect(() => {
    if (entry.sourceType !== "food" || !entry.foodId) return
    const foodId = entry.foodId

    let cancelled = false
    void fetchFoodPortions([foodId])
      .then((byFood) => {
        if (!cancelled) setPortions(byFood.get(foodId) ?? [])
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [entry])

  // Each source keeps its nutrients somewhere different: the catalog in the
  // food map, a scanned product on the row itself, a recipe in the priced
  // facts. All three normalise to "per one unit" here.
  const food = entry.foodId ? foods.get(entry.foodId) : undefined
  const nutrientsPerUnit =
    entry.sourceType === "custom"
      ? entry.customNutrients
      : entry.sourceType === "recipe"
        ? (entry.recipeId ? recipeFacts.get(entry.recipeId) : undefined)
        : food
          ? scaleNutrients(food.nutrients, food.baseAmount, 100)
          : undefined

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{MEAL_SLOT_LABELS[entry.slotType]}</DialogTitle>
          <DialogDescription>Menge prüfen und speichern.</DialogDescription>
        </DialogHeader>

        <ClientEntryDetail
          name={label}
          subtitle={food?.manufacturer}
          nutrientsPerUnit={nutrientsPerUnit}
          unit={entry.sourceType === "recipe" ? "portion" : "g"}
          amount={value}
          onAmountChange={setValue}
          portions={portions}
          references={references}
        />

        <DialogFooter className="sm:justify-between">
          {/* Deleting lives here too: having opened the line to look at it is
              exactly when someone decides it should not be there. */}
          {/* Stacked below the other two on a phone, so it stays left-aligned
              rather than sitting centred under the primary action. */}
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive sm:w-auto"
            onClick={onDelete}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Löschen
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                const parsed = parseEntryAmount(value)
                if (parsed !== undefined) onSave(parsed)
              }}
            >
              Speichern
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
