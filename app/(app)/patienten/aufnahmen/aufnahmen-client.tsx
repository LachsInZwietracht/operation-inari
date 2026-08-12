"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Send } from "lucide-react"
import { toast } from "sonner"

import { IntakeBoardView } from "@/components/intake-board-view"
import { IntakeListView } from "@/components/intake-list-view"
import { IntakeTimelineView } from "@/components/intake-timeline-view"
import { IntakeTransitionDialog } from "@/components/intake-transition-dialog"
import {
  ListFilterBar,
  type ActiveListFilter,
  type FilterFieldDefinition,
} from "@/components/list-filter-bar"
import { ListPageShell } from "@/components/list-page-shell"
import { ListRowSkeleton } from "@/components/list-row-skeleton"
import { PageBreadcrumb } from "@/components/page-breadcrumb"
import { PatientIntakeInviteDialog } from "@/components/patient-intake-invite-dialog"
import { PatientIntakeReview } from "@/components/patient-intake-review"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

import { useCounseling } from "@/hooks/use-counseling"
import { useListUrlState } from "@/hooks/use-list-url-state"
import { usePatientIntake } from "@/hooks/use-patient-intake"
import { usePatients } from "@/hooks/use-patients"
import { usePracticeAppointments } from "@/hooks/use-practice"
import { INDICATION_OPTIONS } from "@/lib/constants"
import { setPatientIntakeStageOverrideClient } from "@/lib/data/patients-client"
import { resolveIntakeTransition, type IntakeTransition } from "@/lib/intake-transitions"
import {
  INTAKE_STAGE_META,
  INTAKE_STAGE_ORDER,
  buildIntakeRows,
  type IntakeRow,
  type IntakeStage,
  type PatientPlanSummary,
} from "@/lib/patient-journey"
import type { CounselingSession, Patient, PracticeAppointment } from "@/lib/types"

interface AufnahmenPageClientProps {
  initialPatients?: Patient[]
  initialSessions?: CounselingSession[]
  initialPlanSummaries?: PatientPlanSummary[]
  initialAppointments?: PracticeAppointment[]
  /** The one clock every waiting time and timeline position is measured from. */
  renderedAt: string
}

const VIEWS = [
  { value: "liste", label: "Liste" },
  { value: "zeit", label: "Zeitachse" },
  { value: "board", label: "Board" },
]

const GROUP_OPTIONS = [
  { value: "stufe", label: "Stufe" },
  { value: "keine", label: "Keine" },
]

const SORT_OPTIONS = [
  { value: "wartezeit", label: "Wartezeit" },
  { value: "name", label: "Name" },
]

/** Every URL parameter this page owns, with the value that means "unset". */
const URL_DEFAULTS = {
  view: "liste",
  name: "",
  stufe: "",
  indikation: "",
  gruppierung: "stufe",
  sortierung: "wartezeit",
}

export function AufnahmenPageClient({
  initialPatients,
  initialSessions,
  initialPlanSummaries = [],
  initialAppointments,
  renderedAt,
}: AufnahmenPageClientProps) {
  const { patients, patchPatientLocal } = usePatients({ initialPatients })
  const { sessions } = useCounseling({ initialSessions })
  const { appointments } = usePracticeAppointments({ initialAppointments })
  const {
    links,
    submissions,
    createLink,
    applySubmission,
    isLoading: intakeLoading,
  } = usePatientIntake()

  const { values, setValue, clearValue } = useListUrlState({ defaults: URL_DEFAULTS })

  const [inviteOpen, setInviteOpen] = useState(false)
  const [reviewRow, setReviewRow] = useState<IntakeRow | null>(null)
  const [applying, setApplying] = useState(false)
  // Rows whose last action failed. The row stays exactly where it is with its
  // action disabled — dropping it would lose the practitioner's place in a list
  // they were working through.
  const [failedRowIds, setFailedRowIds] = useState<ReadonlySet<string>>(new Set())
  // Set once a submission is applied, so the dialog can hand off to the plan
  // instead of silently closing and leaving the user to re-navigate.
  const [appliedPatient, setAppliedPatient] = useState<{ id: string; name: string } | null>(
    null,
  )
  // A card was dragged (or sent via its menu) to another stage. The dialog then
  // names the one fact standing in the way — see lib/intake-transitions.ts.
  const [move, setMove] = useState<{ row: IntakeRow; transition: IntakeTransition } | null>(
    null,
  )

  const now = useMemo(() => new Date(renderedAt), [renderedAt])

  const rows = useMemo(
    () =>
      buildIntakeRows({
        patients,
        links,
        submissions,
        planSummaries: initialPlanSummaries,
        sessions,
        appointments,
        now,
      }),
    [patients, links, submissions, initialPlanSummaries, sessions, appointments, now],
  )

  const visibleRows = useMemo(() => {
    const needle = values.name.trim().toLowerCase()

    const filtered = rows.filter((row) => {
      if (values.stufe && row.stage !== values.stufe) return false
      if (values.indikation && !row.patient?.indications?.includes(values.indikation)) {
        return false
      }
      if (needle) {
        // Match either order, so "Schneider" and "Maria" both find the row.
        const haystack = row.patient
          ? `${row.patient.firstName} ${row.patient.lastName} ${row.patient.lastName} ${row.patient.firstName}`
          : row.displayName
        if (!haystack.toLowerCase().includes(needle)) return false
      }
      return true
    })

    // buildIntakeRows already returns stage-then-waiting order, so only the
    // alternative sort needs work here.
    if (values.sortierung === "name") {
      return [...filtered].sort((a, b) => a.displayName.localeCompare(b.displayName, "de"))
    }
    return filtered
  }, [rows, values.name, values.stufe, values.indikation, values.sortierung])

  const filterFields = useMemo<FilterFieldDefinition[]>(
    () => [
      {
        field: "name",
        label: "Name",
        kind: "text",
        placeholder: "Name oder Einladung…",
      },
      {
        field: "stufe",
        label: "Stufe",
        options: INTAKE_STAGE_ORDER.map((stage) => ({
          value: stage,
          label: INTAKE_STAGE_META[stage].label,
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
    if (values.stufe) {
      active.push({
        field: "stufe",
        label: "Stufe",
        operator: "ist",
        value: values.stufe,
        valueLabel: INTAKE_STAGE_META[values.stufe as IntakeStage].label,
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
  }, [values.name, values.stufe, values.indikation])

  const handleAddFilter = useCallback(
    (filter: ActiveListFilter) => setValue(filter.field, filter.value),
    [setValue],
  )

  async function handleApply() {
    const submission = reviewRow?.pendingSubmission
    if (!submission) return

    const rowId = reviewRow.id
    setApplying(true)
    try {
      const { patientId } = await applySubmission(submission.id)
      toast.success("Angaben übernommen")
      setFailedRowIds((previous) => {
        if (!previous.has(rowId)) return previous
        const next = new Set(previous)
        next.delete(rowId)
        return next
      })
      if (patientId) {
        setAppliedPatient({ id: patientId, name: reviewRow?.displayName ?? "Patient" })
      } else {
        setReviewRow(null)
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Übernahme fehlgeschlagen")
      setFailedRowIds((previous) => new Set(previous).add(rowId))
      setReviewRow(null)
    } finally {
      setApplying(false)
    }
  }

  function closeReview() {
    setReviewRow(null)
    setAppliedPatient(null)
  }

  const handleMove = useCallback((row: IntakeRow, to: IntakeStage) => {
    const transition = resolveIntakeTransition(row, to)
    // Dropped where it already was: nothing to explain, nothing to do.
    if (!transition) return
    setMove({ row, transition })
  }, [])

  const handleClearOverride = useCallback(
    async (row: IntakeRow) => {
      if (!row.patient) return
      const patientId = row.patient.id
      try {
        await setPatientIntakeStageOverrideClient(patientId, null)
        patchPatientLocal(patientId, {
          intakeStageOverride: undefined,
          intakeStageOverrideAt: undefined,
        })
        toast.success("Stufe wird wieder automatisch bestimmt")
      } catch (caught) {
        toast.error(
          caught instanceof Error ? caught.message : "Stufe konnte nicht zurückgesetzt werden",
        )
      }
    },
    [patchPatientLocal],
  )

  const handleOverride = useCallback(
    async (row: IntakeRow, stage: IntakeStage) => {
      if (!row.patient) return
      const patientId = row.patient.id
      try {
        await setPatientIntakeStageOverrideClient(patientId, stage)
        // Reflect it locally so the card moves now rather than on the next
        // reload; the write above is what makes it survive one.
        patchPatientLocal(patientId, {
          intakeStageOverride: stage,
          intakeStageOverrideAt: new Date().toISOString(),
        })
        toast.success(`Stufe von Hand auf „${INTAKE_STAGE_META[stage].label}" gesetzt`)
      } catch (caught) {
        toast.error(
          caught instanceof Error ? caught.message : "Stufe konnte nicht gesetzt werden",
        )
      }
    },
    [patchPatientLocal],
  )

  return (
    <ListPageShell
      // Only the grouped list runs edge to edge; Zeitachse and Board are laid
      // out surfaces and take the handoff's 22px inset.
      padded={values.view !== "liste"}
      header={
        <PageBreadcrumb
          items={[
            { label: "Patienten", href: "/patienten" },
            { label: "Aufnahmen" },
          ]}
        >
          <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
            <Send className="mr-1.5 size-3.5" />
            Einladung
          </Button>
          <Button size="sm" asChild>
            <Link href="/patienten/neu">
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
          groupOptions={GROUP_OPTIONS}
          group={values.gruppierung}
          onGroupChange={(group) => setValue("gruppierung", group)}
          sortOptions={SORT_OPTIONS}
          sort={values.sortierung}
          onSortChange={(sort) => setValue("sortierung", sort)}
        />
      }
    >
      {intakeLoading && rows.length === 0 ? (
        <ListRowSkeleton rows={6} height={44} />
      ) : visibleRows.length === 0 ? (
        <IntakeEmptyState
          hasAnyRows={rows.length > 0}
          onInvite={() => setInviteOpen(true)}
        />
      ) : values.view === "zeit" ? (
        <IntakeTimelineView
          rows={visibleRows}
          onReview={setReviewRow}
          now={now}
          failedRowIds={failedRowIds}
        />
      ) : values.view === "board" ? (
        <IntakeBoardView
          rows={visibleRows}
          onReview={setReviewRow}
          onMove={handleMove}
          onClearOverride={handleClearOverride}
          failedRowIds={failedRowIds}
        />
      ) : (
        <IntakeListView
          rows={visibleRows}
          onReview={setReviewRow}
          grouped={values.gruppierung === "stufe"}
          failedRowIds={failedRowIds}
        />
      )}

      <PatientIntakeInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreate={createLink}
      />

      <IntakeTransitionDialog
        move={move}
        onClose={() => setMove(null)}
        onReview={setReviewRow}
        onInvite={() => setInviteOpen(true)}
        onOverride={handleOverride}
      />

      <Dialog open={Boolean(reviewRow)} onOpenChange={(open) => !open && closeReview()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {appliedPatient ? (
            // The handoff: applying used to save silently and abandon the user
            // mid-workflow. The next step in the chain is always the plan.
            <>
              <DialogHeader>
                <DialogTitle>Angaben übernommen</DialogTitle>
                <DialogDescription>
                  {appliedPatient.name} ist angelegt. Ziele, Vorlieben und Unverträglichkeiten
                  sind hinterlegt — der Plan startet direkt damit.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="sm:flex-1">
                  <Link href={`/ernaehrungsplan?patientId=${appliedPatient.id}`}>
                    Plan für {appliedPatient.name.split(",")[1]?.trim() || "Patient"} erstellen
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/patienten/${appliedPatient.id}`}>Zum Patienten</Link>
                </Button>
                <Button type="button" variant="ghost" onClick={closeReview}>
                  Später
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Angaben von {reviewRow?.displayName}</DialogTitle>
                <DialogDescription>
                  Prüfen und übernehmen. Danach kannst du direkt den Plan starten.
                </DialogDescription>
              </DialogHeader>

              {reviewRow?.pendingSubmission ? (
                <>
                  <PatientIntakeReview submission={reviewRow.pendingSubmission} />
                  <Button type="button" disabled={applying} onClick={handleApply}>
                    {applying ? "Wird übernommen..." : "Übernehmen"}
                  </Button>
                </>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </ListPageShell>
  )
}

function IntakeEmptyState({
  hasAnyRows,
  onInvite,
}: {
  hasAnyRows: boolean
  onInvite: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <p className="text-[13px] text-muted-foreground">
        {hasAnyRows
          ? "Kein Eintrag entspricht den Filtern."
          : "Keine offenen Aufnahmen. Lade jemanden ein, um zu starten."}
      </p>
      {hasAnyRows ? null : (
        <Button size="sm" onClick={onInvite}>
          <Send className="mr-1.5 size-3.5" />
          Einladung senden
        </Button>
      )}
    </div>
  )
}
