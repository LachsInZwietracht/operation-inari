"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { addDays, format, getISOWeek, getISOWeekYear, parseISO, startOfWeek } from "date-fns"
import {
  Archive,
  ArrowRight,
  Copy,
  ExternalLink,
  FileText,
  Flame,
  Loader2,
  MoreHorizontal,
  PencilLine,
  Plus,
  Send,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  /**
   * Set when the list runs inside the planner: opening a plan switches the
   * planner to that day rather than navigating to the standalone route, which
   * would drop the practitioner out of the patient record.
   */
  onOpenPlan?: (plan: DailyMealPlan) => void
  /** Same idea for "new plan": jump to today's day view instead of a route. */
  onCreatePlan?: () => void
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

function getStatusMeta(plan: DailyMealPlan) {
  if (plan.replacedAt) {
    return {
      label: "Ersetzt",
      className: "border-slate-200 bg-slate-50 text-slate-500",
    }
  }
  if (plan.status === "draft" && plan.supersedesPlanId) {
    return {
      label: "Änderungsentwurf",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    }
  }
  return STATUS_META[plan.status ?? "draft"]
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
  const title = plan.title?.trim()
  if (!title) return `Planstand vom ${formatDate(plan.date)}`
  if (title === "Ernährungsplan") return "Planstand"
  if (title.startsWith("Ernährungsplan ")) {
    return `Planstand ${title.slice("Ernährungsplan ".length)}`
  }
  return title
}

function getDietLineName(dietLineId?: string) {
  if (!dietLineId) return null
  return DIET_LINES.find((line) => line.id === dietLineId)?.name ?? dietLineId
}

interface PlanWeekGroup {
  key: string
  weekNumber: number
  weekYear: number
  start: string
  end: string
  days: Array<{ date: string; plans: DailyMealPlan[] }>
}

function groupPlansByWeek(plans: DailyMealPlan[]): PlanWeekGroup[] {
  const weeks = new Map<string, PlanWeekGroup>()

  for (const plan of plans) {
    const parsedDate = parseISO(plan.date)
    const start = format(startOfWeek(parsedDate, { weekStartsOn: 1 }), "yyyy-MM-dd")
    const key = `${getISOWeekYear(parsedDate)}-${String(getISOWeek(parsedDate)).padStart(2, "0")}`
    let week = weeks.get(key)

    if (!week) {
      week = {
        key,
        weekNumber: getISOWeek(parsedDate),
        weekYear: getISOWeekYear(parsedDate),
        start,
        end: format(addDays(parseISO(start), 6), "yyyy-MM-dd"),
        days: [],
      }
      weeks.set(key, week)
    }

    let day = week.days.find((entry) => entry.date === plan.date)
    if (!day) {
      day = { date: plan.date, plans: [] }
      week.days.push(day)
    }
    day.plans.push(plan)
  }

  return [...weeks.values()]
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((week) => ({
      ...week,
      days: week.days.sort((a, b) => a.date.localeCompare(b.date)),
    }))
}

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(parseISO(date))
}

export function PatientMealPlansTab({
  patient,
  initialPlans,
  foods = [],
  recipes = [],
  onOpenPlan,
  onCreatePlan,
}: PatientMealPlansTabProps) {
  const {
    plans,
    activePlans,
    isLoadingRemote,
    archivePlan,
    duplicatePlan,
    copyPlanToPatient,
    deletePlan,
    releasePlan,
    beginRevision,
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
  const [releaseDialogPlan, setReleaseDialogPlan] = useState<DailyMealPlan | null>(null)
  const [isReleasing, setIsReleasing] = useState(false)
  const [startingRevisionId, setStartingRevisionId] = useState<string | null>(null)

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
  const planWeeks = useMemo(() => groupPlansByWeek(plans), [plans])

  const approvedCount = plans.filter(
    (plan) => plan.status === "approved" || plan.status === "active",
  ).length
  const replacedCount = plans.filter((plan) => Boolean(plan.replacedAt)).length
  const archivedCount = plans.filter(
    (plan) => plan.status === "archived" && !plan.replacedAt,
  ).length
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

  const handleReleasePlan = async () => {
    if (!releaseDialogPlan) return
    setIsReleasing(true)
    try {
      const released = await releasePlan(releaseDialogPlan)
      if (released) setReleaseDialogPlan(null)
    } finally {
      setIsReleasing(false)
    }
  }

  const handleBeginRevision = async (plan: DailyMealPlan) => {
    setStartingRevisionId(plan.id)
    try {
      const draft = await beginRevision(plan)
      if (draft) onOpenPlan?.(draft)
    } finally {
      setStartingRevisionId(null)
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
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0 pb-3">
          <div>
            <CardTitle>Versionen &amp; Freigaben</CardTitle>
            <CardDescription>
              Datierte Entwürfe, Freigaben und Revisionen dieses Patienten als klinische Übersicht und Einstieg in den Planer.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={comparisonHref(plans)}>
                <FileText className="mr-2 h-4 w-4" />
                Vergleichen
              </Link>
            </Button>
            {onCreatePlan ? (
              <Button size="sm" onClick={onCreatePlan}>
                <Plus className="mr-2 h-4 w-4" />
                Tagesplan anlegen
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href={mealPlanHref(patient.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tagesplan anlegen
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            <span><strong className="font-medium text-foreground">{plans.length}</strong> Versionen</span>
            <span><strong className="font-medium text-foreground">{activePlans.length}</strong> aktiv sichtbar</span>
            <span><strong className="font-medium text-foreground">{approvedCount}</strong> freigegeben</span>
            <span><strong className="font-medium text-foreground">{replacedCount}</strong> ersetzt</span>
            <span><strong className="font-medium text-foreground">{archivedCount}</strong> archiviert</span>
          </div>
        </CardContent>
      </Card>

      {hasPlans ? (
        <div className="space-y-4">
          {planWeeks.map((week) => (
            <section key={week.key} className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/25 px-4 py-2.5">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">KW {week.weekNumber}/{week.weekYear}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(week.start)} – {formatDate(week.end)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {week.days.length} {week.days.length === 1 ? "Tag" : "Tage"} ·{" "}
                  {week.days.reduce((count, day) => count + day.plans.length, 0)} Versionen
                </p>
              </div>

              <div className="divide-y">
                {week.days.map((day) => (
                  <div key={day.date} className="grid md:grid-cols-[9.5rem_minmax(0,1fr)]">
                    <div className="border-b bg-muted/10 px-4 py-3 md:border-r md:border-b-0">
                      <p className="text-sm font-semibold capitalize">{formatWeekday(day.date)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(day.date)}</p>
                      {day.plans.length > 1 && (
                        <Badge variant="secondary" className="mt-2 font-normal">
                          {day.plans.length} Versionen
                        </Badge>
                      )}
                    </div>

                    <div className="divide-y">
                      {day.plans.map((plan) => {
                        const status = plan.status ?? "draft"
                        const summary = summaries.get(plan.id)
                        const dietLineName = getDietLineName(plan.dietLineId)
                        const isArchived = status === "archived"
                        const isReplaced = Boolean(plan.replacedAt)
                        const isReleased = status === "approved" || status === "active"
                        const hasBeenReleased = isReleased || Boolean(plan.approvedAt)
                        const canOpen = !isArchived
                        const statusMeta = getStatusMeta(plan)
                        const entryCount = summary?.entryCount ?? countPlanEntries(plan)

                        return (
                          <article
                            key={plan.id}
                            data-plan-id={plan.id}
                            data-plan-date={plan.date}
                            aria-label={`${getPlanTitle(plan)}, ${statusMeta.label}, Stand ${plan.revisionNumber ?? 1}`}
                            className="px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="truncate text-sm font-semibold">{getPlanTitle(plan)}</h4>
                                  <Badge variant="outline" className={statusMeta.className}>
                                    {statusMeta.label}
                                  </Badge>
                                  <Badge variant="secondary" className="font-normal">
                                    Stand {plan.revisionNumber ?? 1}
                                  </Badge>
                                  {dietLineName && (
                                    <Badge variant="secondary" className="font-normal">
                                      {dietLineName}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <Utensils className="h-3.5 w-3.5" />
                                    {entryCount} Einträge
                                  </span>
                                  {plan.approvedAt && <span>Freigabe {formatDate(plan.approvedAt)}</span>}
                                  {summary && (
                                    <>
                                      <span>{formatNumber(summary.kcal, 0)} kcal</span>
                                      <span>{formatNumber(summary.protein, 1)} g Eiweiß</span>
                                      <span>{formatNumber(summary.fat, 1)} g Fett</span>
                                      <span>{formatNumber(summary.carbs, 1)} g KH</span>
                                      <span>{formatNumber(summary.be, 1)} BE</span>
                                    </>
                                  )}
                                </div>
                                {plan.notes && (
                                  <p className="line-clamp-1 text-xs text-muted-foreground">{plan.notes}</p>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {canOpen && onOpenPlan ? (
                                  <Button size="sm" variant="outline" onClick={() => onOpenPlan(plan)}>
                                    Öffnen
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                  </Button>
                                ) : canOpen ? (
                                  <Button asChild size="sm" variant="outline">
                                    <Link prefetch={false} href={mealPlanHref(patient.id, plan)}>
                                      Öffnen
                                      <ExternalLink className="ml-2 h-4 w-4" />
                                    </Link>
                                  </Button>
                                ) : null}
                                {status === "draft" && (
                                  <Button
                                    size="sm"
                                    disabled={entryCount === 0}
                                    title={entryCount === 0 ? "Leere Pläne können nicht freigegeben werden" : undefined}
                                    onClick={() => setReleaseDialogPlan(plan)}
                                  >
                                    <Send className="mr-2 h-4 w-4" />
                                    Tag freigeben
                                  </Button>
                                )}
                                {isReleased && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={startingRevisionId === plan.id}
                                    onClick={() => void handleBeginRevision(plan)}
                                  >
                                    {startingRevisionId === plan.id ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <PencilLine className="mr-2 h-4 w-4" />
                                    )}
                                    Änderung beginnen
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-8"
                                      aria-label={`Weitere Aktionen für ${getPlanTitle(plan)}`}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => void duplicatePlan(plan)}>
                                      <Copy className="h-4 w-4" />
                                      Duplizieren
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => openCopyDialog(plan)}>
                                      <UserPlus className="h-4 w-4" />
                                      Für anderen Patienten
                                    </DropdownMenuItem>
                                    {!isArchived && (
                                      <DropdownMenuItem onSelect={() => void archivePlan(plan)}>
                                        <Archive className="h-4 w-4" />
                                        Archivieren
                                      </DropdownMenuItem>
                                    )}
                                    {!hasBeenReleased && !isReplaced && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onSelect={() => setDeleteDialogPlan(plan)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Löschen
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="rounded-full bg-muted p-3">
              <Flame className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Noch kein Tagesplan angelegt</p>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                Lege den ersten datierten Tagesplan an. Er bleibt im Planer
                bearbeitbar und erscheint danach hier in der Übersicht.
              </p>
            </div>
            {onCreatePlan ? (
              <Button onClick={onCreatePlan}>
                <Plus className="mr-2 h-4 w-4" />
                Tagesplan anlegen
              </Button>
            ) : (
              <Button asChild>
                <Link href={mealPlanHref(patient.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tagesplan anlegen
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(copyDialogPlan)} onOpenChange={(open) => !open && setCopyDialogPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Für anderen Patienten kopieren</DialogTitle>
            <DialogDescription>
              Der ursprüngliche Planstand bleibt unverändert. Die Kopie wird beim Zielpatienten als Entwurf
              angelegt.
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
              Planstand kopieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(releaseDialogPlan)}
        onOpenChange={(open) => !open && setReleaseDialogPlan(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Einzelnen Tag freigeben?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser einzelne Tagesplan wird fachlich abgeschlossen, unveränderlich und für den verknüpften Klienten
              sichtbar. Spätere Anpassungen beginnen als neuer Entwurf; bis zu dessen Freigabe bleibt dieser
              Stand gültig.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReleasing}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={isReleasing}
              onClick={(event) => {
                event.preventDefault()
                void handleReleasePlan()
              }}
            >
              {isReleasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verbindlich freigeben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteDialogPlan)}
        onOpenChange={(open) => !open && setDeleteDialogPlan(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Planstand endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogPlan ? `${getPlanTitle(deleteDialogPlan)} wird dauerhaft entfernt. ` : ""}
              Einträge und Versionen dieses Planstands werden ebenfalls gelöscht. Übergebene Planstände bleiben
              als Historie erhalten und können nicht gelöscht werden.
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
