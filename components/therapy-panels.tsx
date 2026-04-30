"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import type { PatientAllergenEntry } from "@/lib/types"
import {
  ALLERGEN_MAP,
  ALLERGEN_TYPE_LABELS,
  ALLERGEN_SEVERITY_LABELS,
} from "@/lib/allergen-constants"

const GLUCOSE_DAY = [
  { time: "06:00", glucose: 95 },
  { time: "08:00", glucose: 128 },
  { time: "10:00", glucose: 142 },
  { time: "12:00", glucose: 165 },
  { time: "14:00", glucose: 148 },
  { time: "16:00", glucose: 132 },
  { time: "18:00", glucose: 175 },
  { time: "20:00", glucose: 156 },
  { time: "22:00", glucose: 118 },
]

const DIET_TEMPLATES = [
  {
    id: "renal",
    title: "Renale Diät",
    description: "Eiweiß angepasst, Phosphat- und Kaliumkontrolle für CKD",
    nutrients: "65 g Protein · 2200 mg Na · 1800 kcal",
  },
  {
    id: "fodmap",
    title: "Low-FODMAP",
    description: "3 Phasen inkl. Re-Introduction für Reizdarm",
    nutrients: "55 g Protein · 60 g Fett · 200 g Kohlenhydrate",
  },
  {
    id: "cardio",
    title: "Herz-Kreislauf",
    description: "Mediterranes Muster, < 10 % gesättigte Fette",
    nutrients: "80 g Protein · 70 g Fett · 230 g Kohlenhydrate",
  },
]

interface DiabetesAnalyticsCardProps {
  patientName: string
}

export function DiabetesAnalyticsCard({ patientName }: DiabetesAnalyticsCardProps) {
  const [carbInput, setCarbInput] = useState("45")
  const [factorInput, setFactorInput] = useState("12")

  const timeInRange = useMemo(() => {
    const inRange = GLUCOSE_DAY.filter((entry) => entry.glucose >= 80 && entry.glucose <= 140).length
    return Math.round((inRange / GLUCOSE_DAY.length) * 100)
  }, [])

  const beValue = useMemo(() => {
    const carbs = parseFloat(carbInput)
    const factor = parseFloat(factorInput) || 12
    if (Number.isNaN(carbs) || carbs <= 0) return "0"
    return (carbs / factor).toFixed(1)
  }, [carbInput, factorInput])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Diabetes-Analytics</CardTitle>
          <CardDescription>CGM-Verlauf & BE-Rechner für {patientName}</CardDescription>
        </div>
        <Badge variant={timeInRange >= 70 ? "secondary" : "destructive"}>{timeInRange}% TIR</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={GLUCOSE_DAY} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="glucose" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis unit=" mg/dl" />
              <Tooltip formatter={(value: number) => `${value} mg/dl`} />
              <Area type="monotone" dataKey="glucose" stroke="#2563eb" fill="url(#glucose)" fillOpacity={1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Kohlenhydrate (g)</Label>
            <Input value={carbInput} onChange={(event) => setCarbInput(event.target.value)} type="number" />
          </div>
          <div>
            <Label>BE-Faktor (g)</Label>
            <Input value={factorInput} onChange={(event) => setFactorInput(event.target.value)} type="number" />
          </div>
          <div>
            <Label>Berechnete BE</Label>
            <p className="mt-3 text-2xl font-semibold">{beValue}</p>
            <p className="text-xs text-muted-foreground">zur Bolusabschätzung</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function KetogenicPlannerCard() {
  const [ratio, setRatio] = useState([3])
  const [kcalTarget, setKcalTarget] = useState("1800")

  const macros = useMemo(() => {
    const cal = parseFloat(kcalTarget) || 0
    const ratioValue = ratio[0]
    const denominator = ratioValue + 1
    const fatCalories = (cal * ratioValue) / denominator
    const proteinAndCarbCalories = cal - fatCalories
    const protein = Math.round((proteinAndCarbCalories * 0.8) / 4)
    const carbs = Math.round((proteinAndCarbCalories * 0.2) / 4)
    const fat = Math.round(fatCalories / 9)
    return { fat, protein, carbs }
  }, [kcalTarget, ratio])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ketogener Planer</CardTitle>
        <CardDescription>Makrosteuerung über Ratio & Kalorienziel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Keto-Ratio (Fett : Eiweiß + Kohlenhydrate)</Label>
            <Slider value={ratio} min={2} max={4.5} step={0.5} onValueChange={setRatio} className="mt-4" />
            <p className="mt-2 text-sm font-medium">{ratio[0]} : 1</p>
          </div>
          <div>
            <Label>Energieziel (kcal)</Label>
            <Input value={kcalTarget} onChange={(event) => setKcalTarget(event.target.value)} type="number" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs uppercase text-muted-foreground">Fett</p>
            <p className="text-2xl font-semibold">{macros.fat} g</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs uppercase text-muted-foreground">Protein</p>
            <p className="text-2xl font-semibold">{macros.protein} g</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-xs uppercase text-muted-foreground">Kohlenhydrate</p>
            <p className="text-2xl font-semibold">{macros.carbs} g</p>
          </div>
        </div>
        <Button type="button" className="w-full">
          Ketoplan generieren
        </Button>
      </CardContent>
    </Card>
  )
}

interface AllergenAutomationCardProps {
  patientAllergens?: PatientAllergenEntry[]
}

export function AllergenAutomationCard({ patientAllergens = [] }: AllergenAutomationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Allergen-Profil</CardTitle>
        <CardDescription>Aktive Allergene und Intoleranzen. Bearbeitung im Diagnosen-Tab.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {patientAllergens.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {patientAllergens.map((entry) => {
              const def = ALLERGEN_MAP.get(entry.allergenId)
              const label = def?.label ?? entry.allergenId
              const variant = entry.type === "allergy" ? "destructive" as const : entry.type === "intolerance" ? "default" as const : "secondary" as const
              return (
                <Badge
                  key={entry.id}
                  variant={variant}
                  className={entry.type === "intolerance" ? "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100" : ""}
                >
                  {label} · {ALLERGEN_TYPE_LABELS[entry.type]} · {ALLERGEN_SEVERITY_LABELS[entry.severity]}
                </Badge>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Allergene oder Intoleranzen hinterlegt. Im Diagnosen-Tab pflegen.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function DietCatalogCard() {
  const [selected, setSelected] = useState<string[]>(["renal"])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Therapievorgaben</CardTitle>
          <CardDescription>Konfigurierbare Diät- und Kostformen.</CardDescription>
        </div>
        <Badge variant="secondary">{selected.length} aktiviert</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {DIET_TEMPLATES.map((template) => (
          <div key={template.id} className="flex flex-col rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{template.title}</p>
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <p className="text-xs text-muted-foreground">{template.nutrients}</p>
            </div>
            <div className="mt-2 flex items-center gap-3 sm:mt-0">
              <Label className="text-sm">Aktiv</Label>
              <Checkbox
                checked={selected.includes(template.id)}
                onCheckedChange={(checked) =>
                  setSelected((prev) =>
                    checked ? [...prev, template.id] : prev.filter((value) => value !== template.id),
                  )
                }
              />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" className="w-full">
          Auswahl auf Therapiekarte anwenden
        </Button>
      </CardContent>
    </Card>
  )
}
