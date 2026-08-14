"use client"

import type { ReactNode } from "react"
import dynamic from "next/dynamic"
import { Activity as ActivityIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ALLERGEN_MAP } from "@/lib/allergen-constants"
import {
  DIET_EXCLUSIONS,
  DIET_EXCLUSION_LABELS,
  DIET_STYLES,
  DIET_STYLE_DESCRIPTIONS,
  DIET_STYLE_LABELS,
} from "@/lib/diet-constants"
import type {
  DietExclusion,
  DietStyle,
  Patient,
  PatientAllergenEntry,
} from "@/lib/types"

const ReferenceProfileSelector = dynamic(
  () => import("@/components/reference-profile-selector").then((mod) => mod.ReferenceProfileSelector),
  { ssr: false },
)

/** Sentinel for "no style selected" — Radix Select rejects an empty value. */
const DIET_STYLE_NONE = "__none__"

interface AktivitaetTabProps {
  patient: Patient
  profileSubNav: ReactNode
  basalMetabolicRate: number
  totalEnergyExpenditure: number
  palValue: string
  palPersisted: boolean
  palOptions: { value: string; label: string }[]
  onPalChange: (value: string) => void
  dietStyle?: DietStyle
  onDietStyleChange: (value: string) => void
  dietExclusions: DietExclusion[]
  onDietExclusionChange: (exclusion: DietExclusion, checked: boolean) => void
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
  palValue,
  palPersisted,
  palOptions,
  onPalChange,
  dietStyle,
  onDietStyleChange,
  dietExclusions,
  onDietExclusionChange,
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
          </div>
        </CardContent>
      </Card>

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
          <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.4fr)_minmax(0,1fr)]">
            <div>
              <Label htmlFor="diet-style">Ernährungsform</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Eine Auswahl. Beschreibt, wie die Person grundsätzlich isst.
              </p>
              <Select value={dietStyle ?? DIET_STYLE_NONE} onValueChange={onDietStyleChange}>
                <SelectTrigger id="diet-style" className="mt-2">
                  <SelectValue placeholder="Keine Angabe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DIET_STYLE_NONE}>Keine Angabe</SelectItem>
                  {DIET_STYLES.map((style) => (
                    <SelectItem key={style} value={style}>
                      {DIET_STYLE_LABELS[style]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dietStyle ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {DIET_STYLE_DESCRIPTIONS[dietStyle]}
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-sm font-medium">Ausschlüsse</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Mehrfachauswahl. Nicht-medizinische Einschränkungen.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {DIET_EXCLUSIONS.map((exclusion) => (
                  <label
                    key={exclusion}
                    className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                  >
                    <Checkbox
                      checked={dietExclusions.includes(exclusion)}
                      onCheckedChange={(checked) =>
                        onDietExclusionChange(exclusion, checked === true)
                      }
                    />
                    <span className="font-medium">{DIET_EXCLUSION_LABELS[exclusion]}</span>
                  </label>
                ))}
              </div>
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
