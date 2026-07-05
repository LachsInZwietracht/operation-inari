"use client"

import type { ReactNode } from "react"
import dynamic from "next/dynamic"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatNumber } from "@/lib/format"
import type { AnthropometricEntry, Patient } from "@/lib/types"

const AnthropometricChart = dynamic(
  () => import("@/components/anthropometric-chart").then((mod) => mod.AnthropometricChart),
  { ssr: false, loading: () => <div className="h-[300px] rounded-md bg-muted/40" /> },
)
const AnthropometricForm = dynamic(
  () => import("@/components/anthropometric-form").then((mod) => mod.AnthropometricForm),
  { ssr: false },
)
const PediatricPercentileChart = dynamic(
  () => import("@/components/pediatric-percentile-chart").then((mod) => mod.PediatricPercentileChart),
  { ssr: false, loading: () => <div className="h-[300px] rounded-md bg-muted/40" /> },
)

interface WeightTrend {
  totalChange: number
  perWeek: number
  direction: string
  startDate: string
  endDate: string
}

interface WeightProjection {
  finished: boolean
  finishDate: Date
  days: number
}

interface BmiPercentile {
  bmi: number
  bracket: string
  refAgeYears: number
}

interface AnthropometrieTabProps {
  patient: Patient
  profileSubNav: ReactNode
  anthroEntries: AnthropometricEntry[]
  chartEntries: AnthropometricEntry[]
  latestAnthro: AnthropometricEntry | null
  anthropometricPending: boolean
  isPediatric: boolean
  bmiPercentile: BmiPercentile | null
  weightTrend: WeightTrend | null
  weightProjection: WeightProjection | null
  weightProgressPercent: number
  hasAmputation: boolean
  amputationFactor: number
  amputationDescriptions: string[]
  correctedBmi: number | null
  getCorrectedBmi: (entry: AnthropometricEntry) => number
  targetWeightInput: string
  setTargetWeightInput: (value: string) => void
  calorieDeficitInput: string
  setCalorieDeficitInput: (value: string) => void
  showAnthroForm: boolean
  setShowAnthroForm: (value: boolean) => void
  onAddEntry: (entry: Omit<AnthropometricEntry, "id" | "createdAt" | "updatedAt">) => void
}

export function AnthropometrieTab({
  patient,
  profileSubNav,
  anthroEntries,
  chartEntries,
  latestAnthro,
  anthropometricPending,
  isPediatric,
  bmiPercentile,
  weightTrend,
  weightProjection,
  weightProgressPercent,
  hasAmputation,
  amputationFactor,
  amputationDescriptions,
  correctedBmi,
  getCorrectedBmi,
  targetWeightInput,
  setTargetWeightInput,
  calorieDeficitInput,
  setCalorieDeficitInput,
  showAnthroForm,
  setShowAnthroForm,
  onAddEntry,
}: AnthropometrieTabProps) {
  return (
    <>
      {profileSubNav}
      {chartEntries.length > 1 && (
        <AnthropometricChart entries={chartEntries} />
      )}

      {isPediatric && anthroEntries.length > 0 && (
        <PediatricPercentileChart
          entries={anthroEntries}
          gender={patient.gender}
          birthDate={patient.dateOfBirth}
        />
      )}

      {latestAnthro && (
        <Card>
          <CardHeader>
            <CardTitle>Anthropometrie-Insights</CardTitle>
            <CardDescription>Korrekturen, Perzentile und Trendanalyse.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">BMI (korrigiert)</p>
              <p className="text-2xl font-semibold">
                {formatNumber(correctedBmi ?? latestAnthro.bmi, 1)}
              </p>
              {hasAmputation ? (
                <p className="text-xs text-muted-foreground">
                  Faktor {(amputationFactor * 100).toFixed(1)} % · {amputationDescriptions.join(", ")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Keine Korrektur notwendig</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Perzentil</p>
              {bmiPercentile ? (
                <div>
                  <p className="text-2xl font-semibold">{bmiPercentile.bracket}</p>
                  <p className="text-xs text-muted-foreground">
                    BMI {formatNumber(bmiPercentile.bmi, 1)} bei {bmiPercentile.refAgeYears.toFixed(1)} Jahren Referenz
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nur für Patienten &lt; 18 Jahre verfügbar.</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Trend</p>
              {weightTrend ? (
                <div>
                  <p className="text-2xl font-semibold">
                    {weightTrend.perWeek > 0 ? "+" : ""}
                    {formatNumber(weightTrend.perWeek, 1)} kg/Woche
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gesamt: {weightTrend.totalChange > 0 ? "+" : ""}
                    {formatNumber(weightTrend.totalChange, 1)} kg · seit {formatDate(weightTrend.startDate)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Trend wird berechnet, sobald mindestens zwei Messungen vorliegen.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {latestAnthro && (
        <Card>
          <CardHeader>
            <CardTitle>Zielgewicht & Projektion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="target-weight">Zielgewicht (kg)</Label>
                <Input
                  id="target-weight"
                  type="number"
                  step="0.1"
                  value={targetWeightInput}
                  onChange={(event) => setTargetWeightInput(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="calorie-deficit">Kaloriendefizit / Tag</Label>
                <Input
                  id="calorie-deficit"
                  type="number"
                  value={calorieDeficitInput}
                  onChange={(event) => setCalorieDeficitInput(event.target.value)}
                />
              </div>
              <div>
                <Label>Zielerreichung</Label>
                <Progress value={weightProgressPercent} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {formatNumber(weightProgressPercent, 0)} % des Weges geschafft
                </p>
              </div>
            </div>
            {weightProjection && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                {weightProjection.finished ? (
                  <p>Zielgewicht bereits erreicht. Weiterer Fokus: Stabilisierung.</p>
                ) : (
                  <p>
                    Prognose: Zielgewicht am {formatDate(weightProjection.finishDate)} (ca. {weightProjection.days}{" "}
                    Tage)
                  </p>
                )}
                {weightTrend && (
                  <p className="text-xs text-muted-foreground">
                    Aktueller Trend: {weightTrend.perWeek > 0 ? "+" : ""}
                    {formatNumber(weightTrend.perWeek, 1)} kg/Woche
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Messwerte</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnthroForm(!showAnthroForm)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Neue Messung
          </Button>
        </CardHeader>
        <CardContent>
          {showAnthroForm && (
            <div className="mb-6 rounded-lg border p-4">
              <AnthropometricForm
                patientId={patient.id}
                defaultHeight={latestAnthro?.height}
                onSubmit={(entry) => {
                  onAddEntry(entry)
                  setShowAnthroForm(false)
                }}
                onCancel={() => setShowAnthroForm(false)}
              />
            </div>
          )}

          {anthroEntries.length > 0 ? (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Gewicht (kg)</TableHead>
                  <TableHead className="text-right">Größe (cm)</TableHead>
                  <TableHead className="text-right">BMI</TableHead>
                  <TableHead className="text-right">Bauchumfang (cm)</TableHead>
                  <TableHead className="text-right">Hüftumfang (cm)</TableHead>
                  <TableHead className="text-right">Körperfett (%)</TableHead>
                  <TableHead className="text-right">Fettfreie Masse (kg)</TableHead>
                  <TableHead className="text-right">Unterhautfett (%)</TableHead>
                  <TableHead className="text-right">Viszerales Fett</TableHead>
                  <TableHead className="text-right">Körperwasser (%)</TableHead>
                  <TableHead className="text-right">Muskelmasse (kg)</TableHead>
                  <TableHead className="text-right">Skelettmuskeln (%)</TableHead>
                  <TableHead className="text-right">Knochenmasse (kg)</TableHead>
                  <TableHead className="text-right">Protein (%)</TableHead>
                  <TableHead className="text-right">BMR (kcal)</TableHead>
                  <TableHead className="text-right">Metab. Alter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...anthroEntries].reverse().map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell className="text-right">{formatNumber(entry.weight, 1)}</TableCell>
                    <TableCell className="text-right">{formatNumber(entry.height, 0)}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(getCorrectedBmi(entry), 1)}
                      {hasAmputation && (
                        <span className="block text-[11px] text-muted-foreground">
                          Messung: {formatNumber(entry.bmi, 1)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.waistCircumference ? formatNumber(entry.waistCircumference, 0) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.hipCircumference ? formatNumber(entry.hipCircumference, 0) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.bodyFatPercentage ? formatNumber(entry.bodyFatPercentage, 1) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.fatFreeMassKg ? formatNumber(entry.fatFreeMassKg, 1) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.subcutaneousFatPercentage ? formatNumber(entry.subcutaneousFatPercentage, 1) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.visceralFatRating ? formatNumber(entry.visceralFatRating, 1) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.bodyWaterPercentage ? formatNumber(entry.bodyWaterPercentage, 1) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.muscleMassKg ? formatNumber(entry.muscleMassKg, 1) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.skeletalMusclePercentage ? formatNumber(entry.skeletalMusclePercentage, 1) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.boneMassKg ? formatNumber(entry.boneMassKg, 2) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.proteinPercentage ? formatNumber(entry.proteinPercentage, 1) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.bmrKcal ? formatNumber(entry.bmrKcal, 0) : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.metabolicAgeYears ? formatNumber(entry.metabolicAgeYears, 0) : "–"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          ) : anthropometricPending ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Messwerte werden synchronisiert.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Messwerte vorhanden.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
