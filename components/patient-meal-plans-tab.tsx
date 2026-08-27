"use client"

import Link from "next/link"
import { useMemo } from "react"
import { addDays, format, getISOWeek, getISOWeekYear, parseISO, startOfWeek } from "date-fns"
import { ArrowRight, ExternalLink, Flame, History, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { usePatientMealPlans } from "@/hooks/use-patient-meal-plans"
import { formatDate } from "@/lib/format"
import type { DailyMealPlan, Food, Patient, Recipe } from "@/lib/types"

interface PatientMealPlansTabProps {
  patient: Patient
  initialPlans?: DailyMealPlan[]
  foods?: Food[]
  recipes?: Recipe[]
  /** Opens the selected working or released week in the embedded planner. */
  onOpenPlan?: (plan: DailyMealPlan) => void
  /** Creates a scratch plan for patients without a prepared week yet. */
  onCreatePlan?: () => void
}

function mealPlanHref(patientId: string, plan?: DailyMealPlan | null) {
  const params = new URLSearchParams({ patientId })
  if (plan?.date) params.set("date", plan.date)
  return `/ernaehrungsplan?${params.toString()}`
}

interface PlanWeekGroup {
  key: string
  weekNumber: number
  weekYear: number
  start: string
  end: string
  plans: DailyMealPlan[]
}

function groupPlansByWeek(plans: DailyMealPlan[]): PlanWeekGroup[] {
  const weeks = new Map<string, PlanWeekGroup>()

  for (const plan of plans) {
    const parsedDate = parseISO(plan.date)
    const start = format(startOfWeek(parsedDate, { weekStartsOn: 1 }), "yyyy-MM-dd")
    const key = `${getISOWeekYear(parsedDate)}-${String(getISOWeek(parsedDate)).padStart(2, "0")}`
    const existing = weeks.get(key)
    if (existing) {
      existing.plans.push(plan)
      continue
    }
    weeks.set(key, {
      key,
      weekNumber: getISOWeek(parsedDate),
      weekYear: getISOWeekYear(parsedDate),
      start,
      end: format(addDays(parseISO(start), 6), "yyyy-MM-dd"),
      plans: [plan],
    })
  }

  return [...weeks.values()].sort((a, b) => b.start.localeCompare(a.start))
}

function isReleased(plan: DailyMealPlan) {
  return plan.status === "approved" || plan.status === "active"
}

function groupHistoricalReleases(plans: DailyMealPlan[]) {
  const releases = new Map<string, DailyMealPlan[]>()
  for (const plan of plans) {
    const key = plan.approvedAt ?? plan.replacedAt ?? `plan-${plan.id}`
    releases.set(key, [...(releases.get(key) ?? []), plan])
  }
  return [...releases.entries()]
    .map(([key, releasePlans]) => ({
      key,
      plans: releasePlans,
      timestamp: releasePlans[0]?.approvedAt ?? releasePlans[0]?.replacedAt,
    }))
    .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))
}

function WeekReleaseCard({
  patient,
  week,
  onOpenPlan,
}: {
  patient: Patient
  week: PlanWeekGroup
  onOpenPlan?: (plan: DailyMealPlan) => void
}) {
  const drafts = week.plans.filter((plan) => plan.status === "draft")
  const currentReleases = week.plans.filter((plan) => isReleased(plan))
  const historicalPlans = week.plans.filter(
    (plan) => plan.status === "archived" || Boolean(plan.replacedAt),
  )
  const historicalReleases = groupHistoricalReleases(historicalPlans)
  const actionPlan = [...drafts, ...currentReleases].sort((a, b) => a.date.localeCompare(b.date))[0]
  const hasCompleteDraft = drafts.length === 7
  const hasCompleteRelease = currentReleases.length === 7
  const releasedAt = currentReleases
    .map((plan) => plan.approvedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)

  const state = hasCompleteDraft
    ? { label: "Arbeitsfassung", className: "border-amber-200 bg-amber-50 text-amber-800" }
    : hasCompleteRelease
      ? { label: "Freigegeben", className: "border-emerald-200 bg-emerald-50 text-emerald-800" }
      : drafts.length > 0
        ? { label: "Entwurf", className: "border-slate-200 bg-slate-50 text-slate-700" }
        : { label: "Unvollständig", className: "border-slate-200 bg-slate-50 text-slate-600" }

  const description = hasCompleteDraft
    ? hasCompleteRelease
      ? "Die bisherige Freigabe bleibt für den Klienten sichtbar."
      : "Die Woche ist als Entwurf in Bearbeitung."
    : hasCompleteRelease
      ? releasedAt ? `Freigegeben am ${formatDate(releasedAt)}.` : "Für den Klienten freigegeben."
      : `${drafts.length || currentReleases.length} von 7 Tagen liegen als aktuelle Arbeitsfassung vor.`

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">KW {week.weekNumber}/{week.weekYear}</h3>
            <Badge variant="outline" className={state.className}>{state.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(week.start)} – {formatDate(week.end)} · {description}
          </p>
        </div>
        {actionPlan && onOpenPlan ? (
          <Button size="sm" variant="outline" onClick={() => onOpenPlan(actionPlan)}>
            Woche öffnen
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : actionPlan ? (
          <Button asChild size="sm" variant="outline">
            <Link prefetch={false} href={mealPlanHref(patient.id, actionPlan)}>
              Woche öffnen
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      {historicalReleases.length > 0 && (
        <Collapsible className="border-t bg-muted/15">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start rounded-none px-4 text-xs text-muted-foreground">
              <History className="mr-2 h-3.5 w-3.5" />
              {historicalReleases.length === 1
                ? "Eine frühere Freigabe"
                : `${historicalReleases.length} frühere Freigaben`}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-4 pb-3 text-xs text-muted-foreground">
            {historicalReleases.map((release) => (
              <div key={release.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/60 px-3 py-2">
                <span>
                  Freigabe {release.timestamp ? `vom ${formatDate(release.timestamp)}` : "ohne Zeitangabe"}
                </span>
                <span>{new Set(release.plans.map((plan) => plan.date)).size} Tage</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  )
}

export function PatientMealPlansTab({
  patient,
  initialPlans,
  onOpenPlan,
  onCreatePlan,
}: PatientMealPlansTabProps) {
  const { plans, activePlans, isLoadingRemote } = usePatientMealPlans(patient, initialPlans)
  const planWeeks = useMemo(() => groupPlansByWeek(plans), [plans])
  const workingWeekCount = planWeeks.filter((week) => week.plans.some((plan) => plan.status === "draft")).length
  const releasedWeekCount = planWeeks.filter(
    (week) => week.plans.filter(isReleased).length === 7,
  ).length

  if (isLoadingRemote && plans.length === 0) {
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
            <CardTitle>Freigaben</CardTitle>
            <CardDescription>
              Freigegebene Wochen bleiben nachvollziehbar; Änderungen entstehen als neue Arbeitsfassung und werden erst mit der nächsten Wochenfreigabe sichtbar.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <span><strong className="font-medium text-foreground">{workingWeekCount}</strong> Arbeitsfassungen</span>
            <span><strong className="font-medium text-foreground">{releasedWeekCount}</strong> freigegebene Wochen</span>
            <span><strong className="font-medium text-foreground">{activePlans.length}</strong> Tage aktuell sichtbar</span>
          </div>
        </CardContent>
      </Card>

      {planWeeks.length > 0 ? (
        <div className="space-y-4">
          <WeekReleaseCard patient={patient} week={planWeeks[0]} onOpenPlan={onOpenPlan} />
          {planWeeks.length > 1 && (
            <Collapsible className="rounded-xl border bg-card shadow-sm">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start px-4 py-5 text-sm">
                  <History className="mr-2 h-4 w-4 text-muted-foreground" />
                  Frühere Wochen ({planWeeks.length - 1})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 border-t p-4">
                {planWeeks.slice(1).map((week) => (
                  <WeekReleaseCard key={week.key} patient={patient} week={week} onOpenPlan={onOpenPlan} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
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
                Lege den ersten datierten Tagesplan an. Er bleibt bis zur Wochenfreigabe frei bearbeitbar.
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
    </div>
  )
}
