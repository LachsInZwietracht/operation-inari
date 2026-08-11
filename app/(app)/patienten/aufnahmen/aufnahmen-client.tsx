"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Send } from "lucide-react"
import { toast } from "sonner"

import { IntakeBoardView } from "@/components/intake-board-view"
import { IntakeListView } from "@/components/intake-list-view"
import { IntakeTimelineView } from "@/components/intake-timeline-view"
import {
  ListFilterBar,
  type ActiveListFilter,
  type FilterFieldDefinition,
} from "@/components/list-filter-bar"
import { ListPageShell } from "@/components/list-page-shell"
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
  const { patients } = usePatients({ initialPatients })
  const { sessions } = useCounseling({ initialSessions })
  const { appointments } = usePracticeAppointments({ initialAppointments })
  const { links, submissions, createLink, applySubmission } = usePatientIntake()

  const { values, setValue, clearValue } = useListUrlState({ defaults: URL_DEFAULTS })

  const [inviteOpen, setInviteOpen] = useState(false)
  const [reviewRow, setReviewRow] = useState<IntakeRow | null>(null)
  const [applying, setApplying] = useState(false)
  // Set once a submission is applied, so the dialog can hand off to the plan
  // instead of silently closing and leaving the user to re-navigate.
  const [appliedPatient, setAppliedPatient] = useState<{ id: string; name: string } | null>(
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
    const filtered = rows.filter((row) => {
      if (values.stufe && row.stage !== values.stufe) return false
      if (values.indikation && !row.patient?.indications?.includes(values.indikation)) {
        return false
      }
      return true
    })

    // buildIntakeRows already returns stage-then-waiting order, so only the
    // alternative sort needs work here.
    if (values.sortierung === "name") {
      return [...filtered].sort((a, b) => a.displayName.localeCompare(b.displayName, "de"))
    }
    return filtered
  }, [rows, values.stufe, values.indikation, values.sortierung])

  const filterFields = useMemo<FilterFieldDefinition[]>(
    () => [
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
  }, [values.stufe, values.indikation])

  const handleAddFilter = useCallback(
    (filter: ActiveListFilter) => setValue(filter.field, filter.value),
    [setValue],
  )

  async function handleApply() {
    const submission = reviewRow?.pendingSubmission
    if (!submission) return

    setApplying(true)
    try {
      const { patientId } = await applySubmission(submission.id)
      toast.success("Angaben übernommen")
      if (patientId) {
        setAppliedPatient({ id: patientId, name: reviewRow?.displayName ?? "Patient" })
      } else {
        setReviewRow(null)
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Übernahme fehlgeschlagen")
    } finally {
      setApplying(false)
    }
  }

  function closeReview() {
    setReviewRow(null)
    setAppliedPatient(null)
  }

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
          groupOptions={GROUP_OPTIONS}
          group={values.gruppierung}
          onGroupChange={(group) => setValue("gruppierung", group)}
          sortOptions={SORT_OPTIONS}
          sort={values.sortierung}
          onSortChange={(sort) => setValue("sortierung", sort)}
        />
      }
    >
      {visibleRows.length === 0 ? (
        <IntakeEmptyState
          hasAnyRows={rows.length > 0}
          onInvite={() => setInviteOpen(true)}
        />
      ) : values.view === "zeit" ? (
        <IntakeTimelineView rows={visibleRows} onReview={setReviewRow} now={now} />
      ) : values.view === "board" ? (
        <IntakeBoardView rows={visibleRows} onReview={setReviewRow} />
      ) : (
        <IntakeListView
          rows={visibleRows}
          onReview={setReviewRow}
          grouped={values.gruppierung === "stufe"}
        />
      )}

      <PatientIntakeInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreate={createLink}
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
