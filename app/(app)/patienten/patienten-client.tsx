"use client"

import { useCallback, useMemo } from "react"
import Link from "next/link"
import { Plus, UserPlus } from "lucide-react"

import { CareKpiRow } from "@/components/care-kpi-row"
import { CareSidePanel } from "@/components/care-side-panel"
import { CareTable } from "@/components/care-table"
import { CareTimelineView } from "@/components/care-timeline-view"
import {
  ListFilterBar,
  type ActiveListFilter,
  type FilterFieldDefinition,
} from "@/components/list-filter-bar"
import { ListPageShell } from "@/components/list-page-shell"
import { ListRowSkeleton } from "@/components/list-row-skeleton"
import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { Button } from "@/components/ui/button"

import { useCounseling } from "@/hooks/use-counseling"
import { useListUrlState } from "@/hooks/use-list-url-state"
import { usePatients } from "@/hooks/use-patients"
import { usePracticeAppointments } from "@/hooks/use-practice"
import { INDICATION_OPTIONS } from "@/lib/constants"
import {
  buildAttentionItems,
  buildCareMetrics,
  buildUpcomingAppointments,
  buildWeekActivity,
} from "@/lib/care-metrics"
import {
  CARE_URGENCY_META,
  buildCareRows,
  type CareUrgency,
  type PatientPlanSummary,
} from "@/lib/patient-journey"
import type { CounselingSession, Patient, PracticeAppointment } from "@/lib/types"

interface PatientenPageClientProps {
  initialPatients?: Patient[]
  initialSessions?: CounselingSession[]
  initialPlanSummaries?: PatientPlanSummary[]
  initialAppointments?: PracticeAppointment[]
  /** The one clock every duration on this page is measured from. */
  renderedAt: string
}

const VIEWS = [
  { value: "liste", label: "Liste" },
  { value: "zeit", label: "Zeitachse" },
]

const SORT_OPTIONS = [
  { value: "status", label: "Status" },
  { value: "name", label: "Name" },
  { value: "planwoche", label: "Planwoche" },
]

const URGENCY_ORDER: CareUrgency[] = ["overdue", "due", "ok"]

const URL_DEFAULTS = {
  view: "liste",
  name: "",
  status: "",
  indikation: "",
  sortierung: "status",
}

/**
 * Ongoing care: every patient with a live plan.
 *
 * The counterpart to Aufnahmen, split at the seam where a plan starts. What
 * this screen does *not* show is deliberate: the design handoff asked for
 * adherence, check-ins, plan runtime and unread messages, none of which this
 * system records. See lib/care-metrics.ts.
 */
export function PatientenPageClient({
  initialPatients,
  initialSessions,
  initialPlanSummaries = [],
  initialAppointments,
  renderedAt,
}: PatientenPageClientProps) {
  const { patients, isLoadingRemote } = usePatients({ initialPatients })
  const { sessions } = useCounseling({ initialSessions })
  const { appointments } = usePracticeAppointments({ initialAppointments })

  const { values, setValue, clearValue } = useListUrlState({ defaults: URL_DEFAULTS })
  const now = useMemo(() => new Date(renderedAt), [renderedAt])

  const rows = useMemo(
    () =>
      buildCareRows({
        patients,
        // Care urgency is derived from plans, sessions and appointments only.
        // Invitations belong to the intake half of the journey, so this page
        // does not fetch them at all.
        links: [],
        submissions: [],
        planSummaries: initialPlanSummaries,
        sessions,
        appointments,
        now,
      }),
    [patients, initialPlanSummaries, sessions, appointments, now],
  )

  const livePlanCount = useMemo(
    () =>
      initialPlanSummaries.filter(
        (plan) => plan.patientId && plan.status !== "archived",
      ).length,
    [initialPlanSummaries],
  )

  const visibleRows = useMemo(() => {
    const needle = values.name.trim().toLowerCase()

    const filtered = rows.filter((row) => {
      if (values.status && row.urgency !== values.status) return false
      if (values.indikation && !row.patient.indications?.includes(values.indikation)) {
        return false
      }
      if (needle) {
        // Match either order, so "Schneider" and "Maria" both find the row.
        const { firstName, lastName } = row.patient
        const haystack = `${firstName} ${lastName} ${lastName} ${firstName}`
        if (!haystack.toLowerCase().includes(needle)) return false
      }
      return true
    })

    if (values.sortierung === "name") {
      return [...filtered].sort((a, b) => a.displayName.localeCompare(b.displayName, "de"))
    }
    if (values.sortierung === "planwoche") {
      return [...filtered].sort((a, b) => b.planWeek - a.planWeek)
    }
    // buildCareRows already returns urgency-then-name order.
    return filtered
  }, [rows, values.name, values.status, values.indikation, values.sortierung])

  // The panels describe the whole caseload, not the current filter — narrowing
  // the table should not hide someone who has gone quiet.
  const metrics = useMemo(
    () => buildCareMetrics({ rows, sessions, livePlanCount, now }),
    [rows, sessions, livePlanCount, now],
  )
  const attention = useMemo(() => buildAttentionItems(rows), [rows])
  const upcoming = useMemo(() => buildUpcomingAppointments(rows), [rows])
  const activity = useMemo(
    () => buildWeekActivity(sessions, rows, now),
    [sessions, rows, now],
  )

  const filterFields = useMemo<FilterFieldDefinition[]>(
    () => [
      {
        field: "name",
        label: "Name",
        kind: "text",
        placeholder: "Patientenname…",
      },
      {
        field: "status",
        label: "Status",
        options: URGENCY_ORDER.map((urgency) => ({
          value: urgency,
          label: CARE_URGENCY_META[urgency].label,
        })),
      },
      {
        field: "indikation",
        label: "Indikation",
        options: INDICATION_OPTIONS.map((indication) => ({
          value: indication,
          label: indication,
        })),
      },
    ],
    [],
  )

  const activeFilters = useMemo<ActiveListFilter[]>(() => {
    const active: ActiveListFilter[] = []
    if (values.name) {
      active.push({
        field: "name",
        label: "Name",
        operator: "enthält",
        value: values.name,
        valueLabel: values.name,
      })
    }
    if (values.status) {
      active.push({
        field: "status",
        label: "Status",
        operator: "ist",
        value: values.status,
        valueLabel: CARE_URGENCY_META[values.status as CareUrgency].label,
      })
    }
    if (values.indikation) {
      active.push({
        field: "indikation",
        label: "Indikation",
        operator: "ist",
        value: values.indikation,
        valueLabel: values.indikation,
      })
    }
    return active
  }, [values.name, values.status, values.indikation])

  const handleAddFilter = useCallback(
    (filter: ActiveListFilter) => setValue(filter.field, filter.value),
    [setValue],
  )

  return (
    <ListPageShell
      padded
      header={
        <PageBreadcrumb items={[{ label: "Patienten" }]}>
          <Button size="sm" variant="outline" asChild>
            <Link href="/patienten/aufnahmen" prefetch={false}>
              <UserPlus className="mr-1.5 size-3.5" />
              Aufnahmen
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/patienten/neu" prefetch={false}>
              <Plus className="mr-1.5 size-3.5" />
              Neuer Patient
            </Link>
          </Button>
        </PageBreadcrumb>
      }
      filterBar={
        <ListFilterBar
          views={VIEWS}
          view={values.view}
          onViewChange={(view) => setValue("view", view)}
          filterFields={filterFields}
          filters={activeFilters}
          onAddFilter={handleAddFilter}
          onRemoveFilter={clearValue}
          sortOptions={SORT_OPTIONS}
          sort={values.sortierung}
          onSortChange={(sort) => setValue("sortierung", sort)}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <CareKpiRow metrics={metrics} />

        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {isLoadingRemote && rows.length === 0 ? (
              <ListRowSkeleton rows={5} height={56} />
            ) : visibleRows.length === 0 ? (
              <CareEmptyState hasAnyRows={rows.length > 0} />
            ) : values.view === "zeit" ? (
              <CareTimelineView rows={visibleRows} now={now} />
            ) : (
              <CareTable rows={visibleRows} />
            )}
          </div>

          <CareSidePanel attention={attention} upcoming={upcoming} activity={activity} />
        </div>
      </div>
    </ListPageShell>
  )
}

function CareEmptyState({ hasAnyRows }: { hasAnyRows: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <p className="text-[13px] text-muted-foreground">
        {hasAnyRows
          ? "Kein Patient entspricht den Filtern."
          : "Noch niemand in laufender Betreuung. Sobald ein Plan startet, erscheint der Patient hier."}
      </p>
      {hasAnyRows ? null : (
        <Button size="sm" asChild>
          <Link href="/patienten/aufnahmen" prefetch={false}>
            Zu den Aufnahmen
          </Link>
        </Button>
      )}
    </div>
  )
}
