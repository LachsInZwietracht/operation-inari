"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Archive,
  CalendarDays,
  Copy,
  ExternalLink,
  FileText,
  Flame,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Utensils,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { usePatients } from "@/hooks/use-patients"
import { DIET_LINES } from "@/lib/reference-data/diet-lines"
import { formatDate, formatNumber } from "@/lib/format"
import { getBroteinheiten, getNutrientValue } from "@/lib/nutrients"
import { aggregatePlanNutrients } from "@/lib/plan-statistics"
import { createRecipeLookup } from "@/lib/recipes"
import { usePatientMealPlans } from "@/hooks/use-patient-meal-plans"
import type { DailyMealPlan, Food, Patient, Recipe } from "@/lib/types"

interface PatientMealPlansTabProps {
  patient: Patient
  initialPlans?: DailyMealPlan[]
  foods?: Food[]
  recipes?: Recipe[]
}

function isoDateToday() {
  return new Date().toISOString().slice(0, 10)
}

const STATUS_META: Record<NonNullable<DailyMealPlan["status"]>, { label: string; className: string }> = {
  draft: {
    label: "Entwurf",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  active: {
    label: "Aktiv",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  approved: {
    label: "Freigegeben",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  archived: {
    label: "Archiviert",
    className: "border-slate-200 bg-slate-50 text-slate-500",
  },
}

function mealPlanHref(patientId: string, plan?: DailyMealPlan | null) {
  const params = new URLSearchParams({ patientId })
  if (plan?.date) params.set("date", plan.date)
  return `/ernaehrungsplan?${params.toString()}`
}

function comparisonHref(plans: DailyMealPlan[]) {
  const selectedPlans = plans.filter((plan) => plan.status !== "archived").slice(0, 8)
  if (selectedPlans.length < 2) return "/ernaehrungsplan/vergleich"
  const params = new URLSearchParams({ plans: selectedPlans.map((plan) => plan.id).join(",") })
  return `/ernaehrungsplan/vergleich?${params.toString()}`
}

function countPlanEntries(plan: DailyMealPlan) {
  return plan.slots.reduce((count, slot) => count + slot.entries.length, 0)
}

function getPlanTitle(plan: DailyMealPlan) {
  return plan.title?.trim() || `Ernährungsplan vom ${formatDate(plan.date)}`
}

function getDietLineName(dietLineId?: string) {
  if (!dietLineId) return null
  return DIET_LINES.find((line) => line.id === dietLineId)?.name ?? dietLineId
}

function PlanMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

export function PatientMealPlansTab({
  patient,
  initialPlans,
  foods = [],
  recipes = [],
}: PatientMealPlansTabProps) {
  const {
    plans,
    activePlans,
    isLoadingRemote,
    archivePlan,
    duplicatePlan,
    copyPlanToPatient,
    deletePlan,
  } = usePatientMealPlans(patient, initialPlans)
  const { patients } = usePatients()
  const [copyDialogPlan, setCopyDialogPlan] = useState<DailyMealPlan | null>(null)
  const [copyTargetPatientId, setCopyTargetPatientId] = useState("")
  const [copyTargetDate, setCopyTargetDate] = useState(isoDateToday)
  const [copyNotes, setCopyNotes] = useState(true)
  const [copyDietLine, setCopyDietLine] = useState(true)
  const [isCopying, setIsCopying] = useState(false)
  const [deleteDialogPlan, setDeleteDialogPlan] = useState<DailyMealPlan | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const foodMap = useMemo(() => {
    const map = new Map<string, Food>()
    for (const food of foods) {
      map.set(food.id, food)
      if (food.legacyId) {
        map.set(food.legacyId, food)
      }
    }
    return map
  }, [foods])
  const recipeMap = useMemo(() => createRecipeLookup(recipes), [recipes])

  const summaries = useMemo(() => {
    const map = new Map<
      string,
      {
        entryCount: number
        kcal: number
        protein: number
        fat: number
        carbs: number
        be: number
      }
    >()

    for (const plan of plans) {
      const totals = aggregatePlanNutrients(plan, foodMap, recipeMap, foods)
      const carbs = getNutrientValue(totals, "kohlenhydrate")
      map.set(plan.id, {
        entryCount: countPlanEntries(plan),
        kcal: getNutrientValue(totals, "energie"),
        protein: getNutrientValue(totals, "eiweiss"),
        fat: getNutrientValue(totals, "fett"),
        carbs,
        be: getBroteinheiten(carbs),
      })
    }

    return map
  }, [foodMap, foods, plans, recipeMap])

  const approvedCount = plans.filter((plan) => plan.status === "approved").length
  const archivedCount = plans.filter((plan) => plan.status === "archived").length
  const hasPlans = plans.length > 0
  const copyTargetPatients = patients.filter(
    (item) => item.id !== patient.id && item.legacyId !== patient.id && item.id !== patient.legacyId,
  )
  const selectedCopyTarget = copyTargetPatients.find(
    (item) => item.id === copyTargetPatientId || item.legacyId === copyTargetPatientId,
  )

  const openCopyDialog = (plan: DailyMealPlan) => {
    setCopyDialogPlan(plan)
    setCopyTargetPatientId("")
    setCopyTargetDate(isoDateToday())
    setCopyNotes(true)
    setCopyDietLine(true)
  }

  const handleCopyToPatient = async () => {
    if (!copyDialogPlan || !selectedCopyTarget) return

    setIsCopying(true)
    try {
      const copied = await copyPlanToPatient(copyDialogPlan, selectedCopyTarget, copyTargetDate, {
        includeNotes: copyNotes,
        includeDietLine: copyDietLine,
      })
      if (copied) {
        setCopyDialogPlan(null)
      }
    } finally {
      setIsCopying(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!deleteDialogPlan) return

    setIsDeleting(true)
    try {
      const deleted = await deletePlan(deleteDialogPlan)
      if (deleted) {
        setDeleteDialogPlan(null)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoadingRemote && !hasPlans) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Ernährungspläne</CardTitle>
            <CardDescription>
              Patientengebundene Tagespläne als klinische Übersicht und Einstieg in den Planner.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={comparisonHref(plans)} prefetch={false}>
                <FileText className="mr-2 h-4 w-4" />
                Vergleichen
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={mealPlanHref(patient.id)} prefetch={false}>
                <Plus className="mr-2 h-4 w-4" />
                Plan anlegen
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <PlanMetric label="Gesamt" value={`${plans.length}`} />
            <PlanMetric label="Aktiv sichtbar" value={`${activePlans.length}`} />
            <PlanMetric label="Freigegeben" value={`${approvedCount}`} />
            <PlanMetric label="Archiviert" value={`${archivedCount}`} />
          </div>
        </CardContent>
      </Card>

      {hasPlans ? (
        <div className="space-y-3">
          {plans.map((plan) => {
            const status = plan.status ?? "draft"
            const summary = summaries.get(plan.id)
            const dietLineName = getDietLineName(plan.dietLineId)
            const isArchived = status === "archived"

            return (
              <Card key={plan.id}>
                <CardHeader className="gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{getPlanTitle(plan)}</CardTitle>
                        <Badge variant="outline" className={STATUS_META[status].className}>
                          {STATUS_META[status].label}
                        </Badge>
                        {dietLineName && (
                          <Badge variant="secondary" className="font-normal">
                            {dietLineName}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(plan.date)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Utensils className="h-3.5 w-3.5" />
                          {summary?.entryCount ?? countPlanEntries(plan)} Einträge
                        </span>
                        {plan.approvedAt && <span>Freigabe {formatDate(plan.approvedAt)}</span>}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={mealPlanHref(patient.id, plan)} prefetch={false}>
                          Öffnen
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void duplicatePlan(plan)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplizieren
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openCopyDialog(plan)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Für anderen Patienten
                      </Button>
                      {!isArchived && (
                        <Button size="sm" variant="ghost" onClick={() => void archivePlan(plan)}>
                          <Archive className="mr-2 h-4 w-4" />
                          Archivieren
                        </Button>
                      )}
                      {status !== "approved" && (
                        <Button size="sm" variant="ghost" onClick={() => setDeleteDialogPlan(plan)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Löschen
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-5">
                    <PlanMetric
                      label="Energie"
                      value={summary ? `${formatNumber(summary.kcal, 0)} kcal` : "n. a."}
                    />
                    <PlanMetric
                      label="Eiweiß"
                      value={summary ? `${formatNumber(summary.protein, 1)} g` : "n. a."}
                    />
                    <PlanMetric
                      label="Fett"
                      value={summary ? `${formatNumber(summary.fat, 1)} g` : "n. a."}
                    />
                    <PlanMetric
                      label="Kohlenhydrate"
                      value={summary ? `${formatNumber(summary.carbs, 1)} g` : "n. a."}
                    />
                    <PlanMetric
                      label="BE"
                      value={summary ? formatNumber(summary.be, 1) : "n. a."}
                    />
                  </div>
                  {plan.notes && (
                    <p className="line-clamp-2 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                      {plan.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="rounded-full bg-muted p-3">
              <Flame className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Noch kein Ernährungsplan angelegt</p>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                Lege den ersten patientengebundenen Tagesplan an. Der Plan bleibt im Planner bearbeitbar und
                erscheint danach hier als Verlauf.
              </p>
            </div>
            <Button asChild>
              <Link href={mealPlanHref(patient.id)} prefetch={false}>
                <Plus className="mr-2 h-4 w-4" />
                Ernährungsplan anlegen
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(copyDialogPlan)} onOpenChange={(open) => !open && setCopyDialogPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Für anderen Patienten kopieren</DialogTitle>
            <DialogDescription>
              Der ursprüngliche Plan bleibt unverändert. Die Kopie wird beim Zielpatienten als Entwurf angelegt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Zielpatient</Label>
              <Select value={copyTargetPatientId} onValueChange={setCopyTargetPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Patient auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {copyTargetPatients.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.lastName}, {item.firstName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {copyTargetPatients.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Es gibt aktuell keinen weiteren Patienten als Kopierziel.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="copy-plan-date">Datum der Kopie</Label>
              <Input
                id="copy-plan-date"
                type="date"
                value={copyTargetDate}
                onChange={(event) => setCopyTargetDate(event.currentTarget.value)}
              />
            </div>
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={copyNotes}
                  onCheckedChange={(checked) => setCopyNotes(checked === true)}
                />
                Notizen übernehmen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={copyDietLine}
                  onCheckedChange={(checked) => setCopyDietLine(checked === true)}
                />
                Kostform übernehmen
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              Freigabe, Versionierung und Patientenbezug werden zurückgesetzt. Allergene und Zielwerte werden
              beim Öffnen im Kontext des Zielpatienten neu geprüft.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogPlan(null)} disabled={isCopying}>
              Abbrechen
            </Button>
            <Button
              onClick={() => void handleCopyToPatient()}
              disabled={!selectedCopyTarget || !copyTargetDate || isCopying}
            >
              {isCopying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Plan kopieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteDialogPlan)}
        onOpenChange={(open) => !open && setDeleteDialogPlan(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ernährungsplan endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogPlan ? `${getPlanTitle(deleteDialogPlan)} wird dauerhaft entfernt. ` : ""}
              Einträge und Versionen dieses Plans werden ebenfalls gelöscht. Freigegebene Pläne können nur
              archiviert werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                void handleDeletePlan()
              }}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
