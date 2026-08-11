"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { addDays, format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { ClientAddEntryDialog } from "@/components/client/client-add-entry-dialog"
import { ClientDayContext } from "@/components/client/client-day-context"
import { ClientDayTotals } from "@/components/client/client-day-totals"
import { ClientPlannedMealList } from "@/components/client/client-planned-meal-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import {
  calculateClientDayNutrients,
  calculatePlannedNutrients,
  clientLogEntryLabel,
  collectFrequentEntries,
  formatLogAmount,
  previousDayEntries,
} from "@/lib/client-food-log"
import { resolveClientDayTarget } from "@/lib/client-targets"
import { isClientModuleEnabled } from "@/lib/client-modules"
import { todayIsoDate } from "@/lib/client-mode"
import {
  addClientFoodLogEntry,
  deleteClientFoodLogEntry,
  ensureClientFoodLogDay,
  fetchClientFoodLogDay,
  fetchClientFoodLogDays,
  updateClientFoodLogDay,
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
  const [addSlot, setAddSlot] = useState<MealSlotType | null>(null)

  const [planFacts, setPlanFacts] = useState<Map<string, ClientPlanEntryFacts>>(new Map())
  const [completions, setCompletions] = useState<Map<string, ClientMealCompletion>>(new Map())
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null)
  const [energy, setEnergy] = useState<ClientEnergyReference | null>(null)
  const [recentDays, setRecentDays] = useState<ClientFoodLogDay[]>([])
  const [savedMeals, setSavedMeals] = useState<ClientSavedMeal[]>([])
  const [recipeFacts, setRecipeFacts] = useState<
    Map<string, { name: string; perPortion: NutrientValue[] }>
  >(new Map())
  const [editingEntry, setEditingEntry] = useState<ClientFoodLogEntry | null>(null)

  const planEnabled = isClientModuleEnabled("plan")
  const planEntries = useMemo(
    () => (planEnabled ? (plan?.entries ?? []) : []),
    [planEnabled, plan],
  )

  // Nutrients for logged catalog foods; custom entries carry their own.
  useEffect(() => {
    const missing = (day?.entries ?? [])
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
  }, [day, foods])

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
        if (!cancelled) setEnergy(history.energy)
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
          (day?.entries ?? [])
            .map((entry) => entry.recipeId)
            .filter((id): id is string => Boolean(id)),
        ),
      ].sort(),
    [day],
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

  // The day as a whole: what was typed in plus what was ticked off the plan.
  const totals = useMemo(
    () =>
      calculateClientDayNutrients({
        entries: day?.entries ?? [],
        foods,
        recipeFacts: new Map(
          [...recipeFacts].map(([id, facts]) => [id, facts.perPortion]),
        ),
        planEntries,
        completions,
        planFacts,
      }),
    [day, foods, recipeFacts, planEntries, completions, planFacts],
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

  /** Copies a slot from the most recent earlier day — the "same as always" case. */
  const copyPreviousDay = useCallback(
    async (slot: MealSlotType) => {
      const source = previousDayEntries(recentDays, date, slot)
      if (source.length === 0) return

      try {
        const resolvedDayId = day?.id ?? (await ensureClientFoodLogDay(date)).id
        for (const entry of source) {
          await addClientFoodLogEntry({
            dayId: resolvedDayId,
            slotType: slot,
            sourceType: entry.sourceType,
            foodId: entry.foodId,
            customName: entry.customName,
            customNutrients: entry.customNutrients,
            amount: entry.amount,
          })
        }
        await refreshDay()
      } catch (error) {
        console.error("Failed to copy the previous day:", error)
        toast.error("Konnte nicht übernommen werden.")
      }
    },
    [recentDays, date, day, refreshDay],
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

      <ClientDayTotals totals={totals} target={target} />

      {SLOT_ORDER.map((slot) => {
        const entries = entriesBySlot.get(slot) ?? []
        const planned = plannedBySlot.get(slot) ?? []
        // Offered only where it would actually save work: an empty slot today
        // that was not empty the day before.
        const repeatable =
          entries.length === 0 && previousDayEntries(recentDays, date, slot).length > 0

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
                {repeatable && (
                  <Button variant="ghost" size="sm" onClick={() => void copyPreviousDay(slot)}>
                    <CopyPlus className="mr-1 h-4 w-4" />
                    Wie gestern
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setAddSlot(slot)}>
                  <Plus className="mr-1 h-4 w-4" />
                  Hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* The plan first: it is the expectation the day is measured
                  against, and answering it is the fastest way to fill the day. */}
              <ClientPlannedMealList
                entries={planned}
                facts={planFacts}
                completions={completions}
                pendingEntryId={pendingEntryId}
                onAnswer={(entry, skipped) => void answerPlanEntry(entry, skipped)}
                onAmount={(entry, amount) => void setPlanEntryAmount(entry, amount)}
              />

              {entries.length === 0 && planned.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Noch nichts eingetragen.</p>
              ) : (
                <ul className="divide-y">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2 py-2">
                      {/* Correcting a portion used to mean deleting the line and
                          entering it again. */}
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setEditingEntry(entry)}
                      >
                        <span className="block truncate text-sm">
                          {clientLogEntryLabel(entry, foods, recipeNames)}
                        </span>
                        <span className="text-xs text-muted-foreground underline underline-offset-2">
                          {formatLogAmount(entry)}
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eintrag löschen"
                        onClick={() => void handleDelete(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* After the meals, not before them: the note is written when the day is
          over, and water is a running tally rather than a headline. */}
      <ClientDayContext
        waterMl={day?.waterMl}
        notes={day?.notes}
        onWaterChange={(waterMl) => void patchDay({ waterMl })}
        onNotesChange={(notes) => void patchDay({ notes })}
      />

      {isRefreshing && (
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Wird aktualisiert
        </p>
      )}

      {/* Mounted per open so the dialog always starts from a clean state. */}
      {addSlot !== null && (
        <ClientAddEntryDialog
          slot={addSlot}
          date={date}
          dayId={day?.id ?? null}
          suggestions={collectFrequentEntries(recentDays, addSlot)}
          foods={foods}
          savedMeals={savedMeals}
          onClose={() => setAddSlot(null)}
          onSaved={() => {
            setAddSlot(null)
            void refreshDay()
          }}
        />
      )}

      {editingEntry && (
        <ClientEntryAmountDialog
          label={clientLogEntryLabel(editingEntry, foods, recipeNames)}
          amount={editingEntry.amount}
          onClose={() => setEditingEntry(null)}
          onSave={(amount) => {
            void saveEntryAmount(editingEntry, amount)
            setEditingEntry(null)
          }}
        />
      )}
    </div>
  )
}

/** Corrects the amount of an entry already written down. */
function ClientEntryAmountDialog({
  label,
  amount,
  onClose,
  onSave,
}: {
  label: string
  amount: number
  onClose: () => void
  onSave: (amount: number) => void
}) {
  const [value, setValue] = useState(String(amount))

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="truncate">{label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="entry-amount">Menge in Gramm</Label>
          <Input
            id="entry-amount"
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            onClick={() => {
              const parsed = Number(value.replace(",", "."))
              if (Number.isFinite(parsed) && parsed > 0) onSave(parsed)
            }}
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
