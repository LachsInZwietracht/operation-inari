"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { addDays, format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { formatPlanAmount } from "@/lib/client-food-log"
import { todayIsoDate } from "@/lib/client-mode"
import {
  clearClientMealCompletion,
  fetchClientMealCompletions,
  setClientMealCompletion,
} from "@/lib/data/client-plan-client"
import { createClient } from "@/lib/supabase/client"
import type {
  ClientMealCompletion,
  ClientPlanDay,
  ClientPlanEntry,
  MealSlotType,
} from "@/lib/types"

const SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

export function ClientPlanView({
  date,
  clientUserId,
  plan,
}: {
  date: string
  clientUserId: string | null
  plan: ClientPlanDay | null
}) {
  const [completions, setCompletions] = useState<Map<string, ClientMealCompletion>>(new Map())
  const [labels, setLabels] = useState<Map<string, string>>(new Map())
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null)

  // Entries are polymorphic: reference_id points at foods or recipes.
  useEffect(() => {
    if (!plan || plan.entries.length === 0) return
    let cancelled = false

    const foodIds = plan.entries.filter((e) => e.entryType === "food").map((e) => e.referenceId)
    const recipeIds = plan.entries.filter((e) => e.entryType === "recipe").map((e) => e.referenceId)

    async function loadLabels() {
      const resolved = new Map<string, string>()

      if (foodIds.length > 0) {
        const response = await fetch("/api/foods/by-ids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [...new Set(foodIds)], nutrientIds: ["energie"] }),
        })
        if (response.ok) {
          const foods = (await response.json()) as { id: string; name: string }[]
          for (const food of foods) resolved.set(food.id, food.name)
        }
      }

      if (recipeIds.length > 0) {
        const { data } = await createClient()
          .from("recipes")
          .select("id,name")
          .in("id", [...new Set(recipeIds)])
        for (const recipe of (data ?? []) as { id: string; name: string }[]) {
          resolved.set(recipe.id, recipe.name)
        }
      }

      if (!cancelled) setLabels(resolved)
    }

    void loadLabels()
    return () => {
      cancelled = true
    }
  }, [plan])

  useEffect(() => {
    if (!plan || !clientUserId) return
    let cancelled = false

    void fetchClientMealCompletions(clientUserId, plan.id)
      .then((rows) => {
        if (cancelled) return
        setCompletions(new Map(rows.map((row) => [row.mealEntryId, row])))
      })
      .catch((error) => console.error("Failed to load meal completions:", error))

    return () => {
      cancelled = true
    }
  }, [plan, clientUserId])

  const answer = useCallback(
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
          // The diary is where a corrected amount is entered; answering here
          // must not silently reset it back to "as planned".
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

  const entriesBySlot = useMemo(() => {
    const grouped = new Map<MealSlotType, ClientPlanEntry[]>()
    for (const slot of SLOT_ORDER) grouped.set(slot, [])
    for (const entry of plan?.entries ?? []) grouped.get(entry.slotType)?.push(entry)
    return grouped
  }, [plan])

  const doneCount = useMemo(
    () => [...completions.values()].filter((completion) => !completion.skipped).length,
    [completions],
  )

  const parsedDate = parseISO(date)
  const today = todayIsoDate()
  const previousDate = format(addDays(parsedDate, -1), "yyyy-MM-dd")
  const nextDate = format(addDays(parsedDate, 1), "yyyy-MM-dd")

  const header = (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="icon" asChild>
        <Link href={`/klient/plan?datum=${previousDate}`} aria-label="Vorheriger Tag">
          <ChevronLeft className="h-5 w-5" />
        </Link>
      </Button>
      <div className="text-center">
        <p className="text-base font-semibold">
          {date === today ? "Heute" : format(parsedDate, "EEEE", { locale: de })}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(parsedDate, "d. MMMM yyyy", { locale: de })}
        </p>
      </div>
      <Button variant="ghost" size="icon" asChild>
        <Link href={`/klient/plan?datum=${nextDate}`} aria-label="Nächster Tag">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </Button>
    </div>
  )

  if (!clientUserId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Anmeldung erforderlich</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Melde dich an, um deinen Plan zu sehen.
        </CardContent>
      </Card>
    )
  }

  if (!plan || plan.entries.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kein Plan für diesen Tag</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sobald deine Ernährungsberatung einen Plan für dich freigibt, steht er hier.
          </CardContent>
        </Card>
      </div>
    )
  }

  const total = plan.entries.length

  return (
    <div className="space-y-4">
      {header}

      <Card>
        <CardContent className="space-y-2 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">
              {doneCount} von {total} {total === 1 ? "Mahlzeit" : "Mahlzeiten"}
            </p>
            {plan.title && <p className="text-xs text-muted-foreground">{plan.title}</p>}
          </div>
          <Progress value={total === 0 ? 0 : (doneCount / total) * 100} />
        </CardContent>
      </Card>

      {SLOT_ORDER.map((slot) => {
        const entries = entriesBySlot.get(slot) ?? []
        if (entries.length === 0) return null

        return (
          <Card key={slot}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{MEAL_SLOT_LABELS[slot]}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="divide-y">
                {entries.map((entry) => {
                  const completion = completions.get(entry.id)
                  const isDone = completion && !completion.skipped
                  const isSkipped = completion?.skipped === true
                  const isPending = pendingEntryId === entry.id

                  return (
                    <li key={entry.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={
                            isSkipped
                              ? "truncate text-sm text-muted-foreground line-through"
                              : "truncate text-sm"
                          }
                        >
                          {labels.get(entry.referenceId) ??
                            (entry.entryType === "recipe" ? "Rezept" : "Lebensmittel")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPlanAmount(
                            completion && !completion.skipped
                              ? (completion.amount ?? entry.amount)
                              : entry.amount,
                            entry.entryType === "recipe" ? "portion" : "g",
                          )}
                          {completion?.amount !== undefined && !completion.skipped
                            ? ` statt ${formatPlanAmount(
                                entry.amount,
                                entry.entryType === "recipe" ? "portion" : "g",
                              )}`
                            : ""}
                        </p>
                      </div>

                      <Button
                        variant={isDone ? "default" : "outline"}
                        size="icon"
                        disabled={isPending}
                        aria-label="Gegessen"
                        aria-pressed={isDone}
                        onClick={() => void answer(entry, false)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={isSkipped ? "secondary" : "outline"}
                        size="icon"
                        disabled={isPending}
                        aria-label="Ausgelassen"
                        aria-pressed={isSkipped}
                        onClick={() => void answer(entry, true)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
