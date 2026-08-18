"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { todayIsoDate } from "@/lib/client-mode"
import { isClientCapabilityEnabled } from "@/lib/client-modules"
import {
  resolveClientMetricPreferences,
  type ClientMetricPreferences,
} from "@/lib/client-metrics"
import { ClientMetricSettings } from "@/components/client/client-metric-settings"
import { fetchClientMetricPreferences } from "@/lib/data/client-checkin-client"
import { fetchActiveLinksForClient } from "@/lib/data/client-links"
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client"
import { recordClientWeight } from "@/lib/data/client-anthropometrics-client"
import {
  fetchClientPatientHistory,
  type ClientPatientHistory,
} from "@/lib/data/client-history-client"
import {
  deleteClientSavedMeal,
  fetchClientSavedMeals,
} from "@/lib/data/client-saved-meals-client"
import type { ClientSavedMeal } from "@/lib/types"

/**
 * Everything that is not a day.
 *
 * The split is deliberate: what the client owns they can change here, what
 * their counselor owns they can only read. Name and goal weight belong to the
 * practice record and are shown as what they are — someone else's entry about
 * you — rather than as a form that silently rewrites a clinical file.
 *
 * Date of birth and sex are absent, and that is not an oversight. They never
 * cross `client_patient_history()`; the reference values computed from them do.
 * Showing them here would mean widening that projection for a field nobody
 * needs to see.
 */
export function ClientSettingsView({ clientUserId }: { clientUserId: string | null }) {
  const [history, setHistory] = useState<ClientPatientHistory | null>(null)
  const [meals, setMeals] = useState<ClientSavedMeal[]>([])
  const [preferences, setPreferences] = useState<ClientMetricPreferences | null>(null)
  const [canShare, setCanShare] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clientUserId) {
      setIsLoading(false)
      return
    }
    try {
      // Independently: someone without a counselor still has saved meals, and
      // still decides what they track.
      const [patientHistory, savedMeals, metricPreferences, links] = await Promise.allSettled([
        fetchClientPatientHistory(),
        fetchClientSavedMeals(),
        fetchClientMetricPreferences(),
        fetchActiveLinksForClient(createBrowserSupabaseClient(), clientUserId),
      ])
      if (patientHistory.status === "fulfilled") setHistory(patientHistory.value)
      if (savedMeals.status === "fulfilled") setMeals(savedMeals.value)
      setPreferences(
        resolveClientMetricPreferences(
          metricPreferences.status === "fulfilled" ? metricPreferences.value : [],
        ),
      )
      // Sharing can only ever narrow the consent given at link time, so the
      // switches stay inert until there is a consent to narrow.
      setCanShare(
        links.status === "fulfilled" && links.value.some((link) => link.consentWellbeing),
      )
    } finally {
      setIsLoading(false)
    }
  }, [clientUserId])

  useEffect(() => {
    void load()
  }, [load])

  if (!clientUserId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Anmeldung erforderlich</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Melde dich an, um deine Einstellungen zu sehen.
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Wird geladen
      </p>
    )
  }

  const latest = history?.measurements[history.measurements.length - 1]

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Einstellungen</h1>

      <PersonalDataCard
        firstName={history?.patient?.firstName}
        goalWeight={history?.patient?.goalWeight}
        weightKg={latest?.weight}
        heightCm={latest?.height}
        onSaved={() => void load()}
      />

      {isClientCapabilityEnabled("befinden") && preferences && (
        <ClientMetricSettings
          preferences={preferences}
          canShare={canShare}
          shareHint="Teilen wird möglich, sobald du mit einer Beratung verbunden bist und der Einsicht in dein Befinden zugestimmt hast."
        />
      )}

      <SavedMealsCard
        meals={meals}
        onDeleted={(id) => setMeals((prev) => prev.filter((meal) => meal.id !== id))}
      />
    </div>
  )
}

/** A stored number back into a field, in the notation people type here. */
function formatNumberField(value?: number): string {
  return value === undefined ? "" : String(value).replace(".", ",")
}

function PersonalDataCard({
  firstName,
  goalWeight,
  weightKg,
  heightCm,
  onSaved,
}: {
  firstName?: string
  goalWeight?: number
  weightKg?: number
  heightCm?: number
  onSaved: () => void
}) {
  const [weight, setWeight] = useState(formatNumberField(weightKg))
  const [height, setHeight] = useState(formatNumberField(heightCm))
  const [isSaving, setIsSaving] = useState(false)

  const isDirty =
    weight !== formatNumberField(weightKg) || height !== formatNumberField(heightCm)

  async function save() {
    const parsedWeight = Number(weight.replace(",", "."))
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      toast.error("Bitte gib dein Gewicht in Kilogramm ein.")
      return
    }
    const parsedHeight = height ? Number(height.replace(",", ".")) : undefined
    if (height && (!parsedHeight || !Number.isFinite(parsedHeight))) {
      toast.error("Bitte gib deine Größe in Zentimetern ein.")
      return
    }

    setIsSaving(true)
    try {
      // Height has no record of its own — it travels on a measurement, so
      // changing it means writing today's weight with the new height.
      await recordClientWeight({
        weightKg: parsedWeight,
        date: todayIsoDate(),
        heightCm: parsedHeight,
      })
      toast.success("Gespeichert.")
      onSaved()
    } catch (error) {
      console.error("Failed to save personal data:", error)
      toast.error("Konnte nicht gespeichert werden.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Persönliche Daten</CardTitle>
        <CardDescription>
          Größe und Gewicht kannst du selbst pflegen. Sie landen als Messung in deinem Verlauf.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="settings-weight">Gewicht in kg</Label>
            <Input
              id="settings-weight"
              inputMode="decimal"
              placeholder="72,4"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-height">Größe in cm</Label>
            <Input
              id="settings-height"
              inputMode="decimal"
              placeholder="170"
              value={height}
              onChange={(event) => setHeight(event.target.value)}
            />
          </div>
        </div>

        <Button size="sm" disabled={!isDirty || isSaving} onClick={() => void save()}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Speichern
        </Button>

        {/* Read-only on purpose: this is the practice's record of you, not a
            form. Changing it is a conversation, not a field. */}
        {(firstName || goalWeight !== undefined) && (
          <div className="space-y-1 border-t pt-3">
            <p className="text-xs text-muted-foreground">Bei deiner Beratung hinterlegt</p>
            {firstName && (
              <p className="text-sm">
                Vorname <span className="text-muted-foreground">{firstName}</span>
              </p>
            )}
            {goalWeight !== undefined && (
              <p className="text-sm">
                Zielgewicht{" "}
                <span className="tabular-nums text-muted-foreground">{goalWeight} kg</span>
              </p>
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              Stimmt etwas nicht? Sag es deiner Beratung — sie pflegt diese Angaben.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SavedMealsCard({
  meals,
  onDeleted,
}: {
  meals: ClientSavedMeal[]
  onDeleted: (id: string) => void
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function remove(meal: ClientSavedMeal) {
    setPendingId(meal.id)
    try {
      await deleteClientSavedMeal(meal.id)
      onDeleted(meal.id)
      toast.success(`„${meal.name}" gelöscht.`)
    } catch (error) {
      console.error("Failed to delete saved meal:", error)
      toast.error("Konnte nicht gelöscht werden.")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Gespeicherte Mahlzeiten</CardTitle>
        <CardDescription>
          Zusammenstellungen, die du im Tagebuch mit einem Tap einträgst.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {meals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine. Im Tagebuch kannst du eine gefüllte Mahlzeit über das Lesezeichen-Symbol
            speichern.
          </p>
        ) : (
          <ul className="divide-y">
            {meals.map((meal) => (
              <li key={meal.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{meal.name}</p>
                  {/* Count and total weight rather than the ingredient names:
                      those live in the food catalog, and loading it for a
                      list you only ever come here to delete from is a query
                      for nothing. */}
                  <p className="truncate text-xs text-muted-foreground">
                    {meal.items.length} {meal.items.length === 1 ? "Zutat" : "Zutaten"}
                    {" · "}
                    {Math.round(meal.items.reduce((sum, item) => sum + item.amount, 0))} g
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${meal.name} löschen`}
                  disabled={pendingId === meal.id}
                  onClick={() => void remove(meal)}
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
}
