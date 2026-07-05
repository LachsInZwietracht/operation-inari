"use client"

import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react"
import dynamic from "next/dynamic"
import { Activity as ActivityIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/format"
import { ALLERGEN_MAP } from "@/lib/allergen-constants"
import type { ActivityEntry, NutritionPreference, Patient, PatientAllergenEntry } from "@/lib/types"

const ReferenceProfileSelector = dynamic(
  () => import("@/components/reference-profile-selector").then((mod) => mod.ReferenceProfileSelector),
  { ssr: false },
)

const NUTRITION_PREFERENCE_OPTIONS: { id: NutritionPreference; label: string; description: string }[] = [
  { id: "vegetarian", label: "Vegetarisch", description: "ohne Fleisch und Fisch" },
  { id: "vegan", label: "Vegan", description: "ohne tierische Zutaten" },
  { id: "keto", label: "Keto", description: "ketogene Auswahl bevorzugen" },
  { id: "low_carb", label: "Low Carb", description: "kohlenhydratarm bevorzugen" },
]

export interface ActivityFormState {
  type: string
  durationMinutes: string
  intensity: string
  date: string
}

interface AktivitaetTabProps {
  patient: Patient
  profileSubNav: ReactNode
  basalMetabolicRate: number
  totalEnergyExpenditure: number
  activityKcal: number
  palValue: string
  palPersisted: boolean
  palOptions: { value: string; label: string }[]
  onPalChange: (value: string) => void
  activityForm: ActivityFormState
  setActivityForm: Dispatch<SetStateAction<ActivityFormState>>
  onActivitySubmit: (event: FormEvent<HTMLFormElement>) => void
  activities: ActivityEntry[]
  activitiesPending: boolean
  nutritionPreferences: NutritionPreference[]
  onNutritionPreferenceChange: (preference: NutritionPreference, checked: boolean) => void
  nutritionPreferenceNotes: string
  setNutritionPreferenceNotes: (value: string) => void
  onNutritionPreferenceNotesBlur: () => void
  nutritionPreferenceAllergens: PatientAllergenEntry[]
  allergensPending: boolean
  onManageAllergens: () => void
}

export function AktivitaetTab({
  patient,
  profileSubNav,
  basalMetabolicRate,
  totalEnergyExpenditure,
  activityKcal,
  palValue,
  palPersisted,
  palOptions,
  onPalChange,
  activityForm,
  setActivityForm,
  onActivitySubmit,
  activities,
  activitiesPending,
  nutritionPreferences,
  onNutritionPreferenceChange,
  nutritionPreferenceNotes,
  setNutritionPreferenceNotes,
  onNutritionPreferenceNotesBlur,
  nutritionPreferenceAllergens,
  allergensPending,
  onManageAllergens,
}: AktivitaetTabProps) {
  return (
    <>
      {profileSubNav}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ActivityIcon className="h-4 w-4" /> Referenzwerte & Energiebedarf
            </CardTitle>
            <CardDescription>
              Referenzstandard, Lebensphase und Energiebedarf (Grundumsatz × PAL) des Patienten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReferenceProfileSelector
              patientId={patient.id}
              dateOfBirth={patient.dateOfBirth}
              gender={patient.gender}
            />
            <div className="space-y-3 border-t pt-4">
              <p className="text-xs uppercase text-muted-foreground">Energiebedarf</p>
              <div className="flex flex-wrap items-stretch gap-2">
                <div className="flex-1 min-w-[88px] rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Grundumsatz</p>
                  <p className="text-xl font-semibold">
                    {basalMetabolicRate}
                    <span className="text-xs font-normal text-muted-foreground"> kcal</span>
                  </p>
                </div>
                <span className="self-center text-lg text-muted-foreground">×</span>
                <div className="flex-1 min-w-[88px] rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">PAL</p>
                  <p className="text-xl font-semibold">{palValue}</p>
                </div>
                <span className="self-center text-lg text-muted-foreground">=</span>
                <div className="flex-1 min-w-[88px] rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground">Tagesbedarf</p>
                  <p className="text-xl font-semibold">
                    {totalEnergyExpenditure}
                    <span className="text-xs font-normal text-muted-foreground"> kcal</span>
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>PAL-Faktor</Label>
                  <Badge variant={palPersisted ? "secondary" : "outline"} className="text-xs font-normal">
                    {palPersisted ? "Gespeichert" : "Standardwert"}
                  </Badge>
                </div>
                <Select value={palValue} onValueChange={onPalChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {palOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activityKcal > 0 && (
                <p className="text-xs text-muted-foreground">Aktivität (Log): {activityKcal} kcal</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Aktivitätsprotokoll</CardTitle>
              <CardDescription>Tägliche Bewegungen & Bewegungstypen.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 md:grid-cols-4" onSubmit={onActivitySubmit}>
              <div className="md:col-span-2">
                <Label>Aktivität</Label>
                <Input
                  value={activityForm.type}
                  onChange={(event) => setActivityForm((prev) => ({ ...prev, type: event.target.value }))}
                  placeholder="Spaziergang"
                  required
                />
              </div>
              <div>
                <Label>Dauer (Minuten)</Label>
                <Input
                  type="number"
                  min={5}
                  value={activityForm.durationMinutes}
                  onChange={(event) => setActivityForm((prev) => ({ ...prev, durationMinutes: event.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Datum</Label>
                <Input
                  type="date"
                  value={activityForm.date}
                  onChange={(event) => setActivityForm((prev) => ({ ...prev, date: event.target.value }))}
                />
              </div>
              <div className="md:col-span-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="activity-intensity" className="text-xs text-muted-foreground">
                    Intensität
                  </Label>
                  <Select
                    value={activityForm.intensity}
                    onValueChange={(value) => setActivityForm((prev) => ({ ...prev, intensity: value }))}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leicht">Leicht</SelectItem>
                      <SelectItem value="moderat">Moderat</SelectItem>
                      <SelectItem value="intensiv">Intensiv</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit">Aktivität speichern</Button>
              </div>
            </form>
            <div className="flex flex-wrap gap-2">
              {activities.length > 0 ? (
                activities.map((entry) => (
                  <Badge key={entry.id} variant="secondary" className="flex items-center gap-1">
                    {entry.type}
                    <span className="text-muted-foreground text-[11px]">
                      {formatDate(entry.date)} · {entry.durationMinutes} min
                    </span>
                  </Badge>
                ))
              ) : activitiesPending ? (
                <p className="text-sm text-muted-foreground">Aktivitäten werden synchronisiert.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Keine Aktivitäten erfasst.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Ernährungsvorlieben</CardTitle>
            <CardDescription>
              Strukturierte Vorlieben für Rezeptfilter, Planung und Beratung.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onManageAllergens}>
            Allergien verwalten
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm font-medium">Ernährungsform</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {NUTRITION_PREFERENCE_OPTIONS.map((option) => (
                <label key={option.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <Checkbox
                    checked={nutritionPreferences.includes(option.id)}
                    onCheckedChange={(checked) =>
                      onNutritionPreferenceChange(option.id, checked === true)
                    }
                  />
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
            <div>
              <Label htmlFor="nutrition-preference-notes">Weitere Vorlieben / Abneigungen</Label>
              <Textarea
                id="nutrition-preference-notes"
                rows={3}
                value={nutritionPreferenceNotes}
                onChange={(event) => setNutritionPreferenceNotes(event.target.value)}
                onBlur={onNutritionPreferenceNotesBlur}
                placeholder="z. B. mag keine Pilze, bevorzugt warme Frühstücke, isst keinen Fisch"
              />
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Medizinische Ausschlüsse</p>
                <Badge variant="outline" className="text-xs">
                  Allergieprofil
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {nutritionPreferenceAllergens.length > 0 ? (
                  nutritionPreferenceAllergens.map((entry) => {
                    const def = ALLERGEN_MAP.get(entry.allergenId)
                    return (
                      <Badge key={entry.id} variant={entry.type === "allergy" ? "destructive" : "secondary"}>
                        {def?.label ?? entry.allergenId}
                      </Badge>
                    )
                  })
                ) : allergensPending ? (
                  <p className="text-sm text-muted-foreground">Ausschlüsse werden synchronisiert.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Keine Allergien oder Intoleranzen hinterlegt.
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
