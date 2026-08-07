"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { addDays, format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ClientAddEntryDialog } from "@/components/client/client-add-entry-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import {
  CLIENT_LOG_NUTRIENT_IDS,
  calculateClientLogNutrients,
  clientLogEntryLabel,
} from "@/lib/client-food-log"
import { todayIsoDate } from "@/lib/client-mode"
import {
  deleteClientFoodLogEntry,
  fetchClientFoodLogDay,
} from "@/lib/data/client-food-log-client"
import { getNutrientValue } from "@/lib/nutrients"
import type { ClientFoodLogDay, Food, MealSlotType } from "@/lib/types"

const SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

async function fetchFoodsByIds(ids: string[]): Promise<Food[]> {
  if (ids.length === 0) return []
  const response = await fetch("/api/foods/by-ids", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, nutrientIds: CLIENT_LOG_NUTRIENT_IDS }),
  })
  if (!response.ok) return []
  return (await response.json()) as Food[]
}

export function ClientFoodLogView({
  date,
  clientUserId,
  initialDay,
}: {
  date: string
  clientUserId: string | null
  initialDay: ClientFoodLogDay | null
}) {
  // The page keys this component by date, so a day switch remounts it and the
  // initial day never needs syncing back into state.
  const [day, setDay] = useState<ClientFoodLogDay | null>(initialDay)
  const [foods, setFoods] = useState<Map<string, Food>>(new Map())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [addSlot, setAddSlot] = useState<MealSlotType | null>(null)

  // Nutrients for logged catalog foods; custom entries carry their own.
  useEffect(() => {
    const missing = (day?.entries ?? [])
      .map((entry) => entry.foodId)
      .filter((foodId): foodId is string => Boolean(foodId) && !foods.has(foodId as string))

    if (missing.length === 0) return

    let cancelled = false
    void fetchFoodsByIds([...new Set(missing)]).then((loaded) => {
      if (cancelled || loaded.length === 0) return
      setFoods((prev) => {
        const next = new Map(prev)
        for (const food of loaded) next.set(food.id, food)
        return next
      })
    })

    return () => {
      cancelled = true
    }
  }, [day, foods])

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

  const totals = useMemo(
    () => calculateClientLogNutrients(day?.entries ?? [], foods),
    [day, foods],
  )

  const entriesBySlot = useMemo(() => {
    const grouped = new Map<MealSlotType, ClientFoodLogDay["entries"]>()
    for (const slot of SLOT_ORDER) grouped.set(slot, [])
    for (const entry of day?.entries ?? []) {
      grouped.get(entry.slotType)?.push(entry)
    }
    return grouped
  }, [day])

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

      <Card>
        <CardContent className="grid grid-cols-4 gap-2 py-4 text-center">
          <Total label="kcal" value={getNutrientValue(totals, "energie")} digits={0} />
          <Total label="Eiweiß" value={getNutrientValue(totals, "eiweiss")} unit="g" />
          <Total label="Fett" value={getNutrientValue(totals, "fett")} unit="g" />
          <Total label="KH" value={getNutrientValue(totals, "kohlenhydrate")} unit="g" />
        </CardContent>
      </Card>

      {SLOT_ORDER.map((slot) => {
        const entries = entriesBySlot.get(slot) ?? []

        return (
          <Card key={slot}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{MEAL_SLOT_LABELS[slot]}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAddSlot(slot)}>
                <Plus className="mr-1 h-4 w-4" />
                Hinzufügen
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {entries.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Noch nichts eingetragen.</p>
              ) : (
                <ul className="divide-y">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{clientLogEntryLabel(entry, foods)}</p>
                        <p className="text-xs text-muted-foreground">{entry.amount} g</p>
                      </div>
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
          onClose={() => setAddSlot(null)}
          onSaved={() => {
            setAddSlot(null)
            void refreshDay()
          }}
        />
      )}
    </div>
  )
}

function Total({
  label,
  value,
  unit,
  digits = 1,
}: {
  label: string
  value: number
  unit?: string
  digits?: number
}) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">
        {value.toFixed(digits)}
        {unit ? <span className="text-xs font-normal text-muted-foreground"> {unit}</span> : null}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
