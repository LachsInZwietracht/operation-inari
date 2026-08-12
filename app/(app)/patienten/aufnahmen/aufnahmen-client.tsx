"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, Send, Trash2 } from "lucide-react"
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
import { PatientIntakeReviewEditor } from "@/components/patient-intake-review-editor"
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
import type {
  CounselingSession,
  Patient,
  PatientIntakeLink,
  PatientIntakePayload,
  PatientIntakeSubmission,
  PracticeAppointment,
} from "@/lib/types"

interface AufnahmenPageClientProps {
  initialPatients?: Patient[]
  initialSessions?: CounselingSession[]
  initialPlanSummaries?: PatientPlanSummary[]
  initialAppointments?: PracticeAppointment[]
  initialLinks?: PatientIntakeLink[]
  initialSubmissions?: PatientIntakeSubmission[]
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
  initialLinks,
  initialSubmissions,
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
    discardSubmission,
    isLoading: intakeLoading,
  } = usePatientIntake({ initialLinks, initialSubmissions })

  const { values, setValue, clearValue } = useListUrlState({ defaults: URL_DEFAULTS })

  const [inviteOpen, setInviteOpen] = useState(false)
  const [reviewRow, setReviewRow] = useState<IntakeRow | null>(null)
  const [reviewPayload, setReviewPayload] = useState<PatientIntakePayload | null>(null)
  const [reviewerNotes, setReviewerNotes] = useState("")
  const [applying, setApplying] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
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

  const openReview = useCallback((row: IntakeRow) => {
    setReviewRow(row)
    setReviewPayload(row.pendingSubmission?.payload ?? null)
    setReviewerNotes(row.pendingSubmission?.reviewerNotes ?? "")
  }, [])

  async function handleApply() {
    const submission = reviewRow?.pendingSubmission
    if (!submission) return

    const rowId = reviewRow.id
    setApplying(true)
    try {
      const { patientId } = await applySubmission(submission.id, {
        payload: reviewPayload ?? submission.payload,
        reviewerNotes,
      })
      toast.success("Angaben übernommen")
      setFailedRowIds((previous) => {
        if (!previous.has(rowId)) return previous
        const next = new Set(previous)
        next.delete(rowId)
        return next
      })
      if (patientId) {
        const appliedPayload = reviewPayload ?? submission.payload
        setAppliedPatient({
          id: patientId,
          name: `${appliedPayload.person.firstName} ${appliedPayload.person.lastName}`,
        })
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

  async function handleDiscard() {
    const submission = reviewRow?.pendingSubmission
    if (!submission) return

    setDiscarding(true)
    try {
      await discardSubmission(submission.id, { reviewerNotes })
      toast.success("Einreichung verworfen")
      setDiscardConfirmOpen(false)
      closeReview()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Verwerfen fehlgeschlagen")
    } finally {
      setDiscarding(false)
    }
  }

  function closeReview() {
    setReviewRow(null)
    setReviewPayload(null)
    setReviewerNotes("")
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
          items={[{ label: "Aufnahmen" }]}
        >
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Send className="mr-1.5 size-3.5" />
            Einladung
          </Button>
          <Button size="sm" variant="outline" asChild>
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
          onReview={openReview}
          now={now}
          failedRowIds={failedRowIds}
        />
      ) : values.view === "board" ? (
        <IntakeBoardView
          rows={visibleRows}
          onReview={openReview}
          onMove={handleMove}
          onClearOverride={handleClearOverride}
          failedRowIds={failedRowIds}
        />
      ) : (
        <IntakeListView
          rows={visibleRows}
          onReview={openReview}
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
        onReview={openReview}
        onInvite={() => setInviteOpen(true)}
        onOverride={handleOverride}
      />

      <Dialog open={Boolean(reviewRow)} onOpenChange={(open) => !open && closeReview()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {appliedPatient ? (
            // Applying keeps the choice with the practitioner: continue in the
            // patient record, start a plan, or return to the work list.
            <>
              <DialogHeader>
                <DialogTitle>Angaben übernommen</DialogTitle>
                <DialogDescription>
                  {appliedPatient.name} ist angelegt. Ziele, Vorlieben,
                  Unverträglichkeiten und deine Prüfnotiz sind gespeichert.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="sm:flex-1">
                  <Link href={`/ernaehrungsplan?patientId=${appliedPatient.id}`}>
                    Ernährungsplan erstellen
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/patienten/${appliedPatient.id}`}>Patientenakte öffnen</Link>
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
                  Prüfe Widersprüche, korrigiere Angaben und entscheide dann über die
                  Übernahme.
                </DialogDescription>
              </DialogHeader>

              {reviewRow?.pendingSubmission && reviewPayload ? (
                <>
                  <PatientIntakeReviewEditor
                    submission={reviewRow.pendingSubmission}
                    payload={reviewPayload}
                    onPayloadChange={setReviewPayload}
                    reviewerNotes={reviewerNotes}
                    onReviewerNotesChange={setReviewerNotes}
                  />
                  <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={applying || discarding}
                      onClick={() => setDiscardConfirmOpen(true)}
                    >
                      <Trash2 className="mr-1.5 size-4" />
                      Verwerfen
                    </Button>
                    <Button type="button" disabled={applying || discarding} onClick={handleApply}>
                      {applying ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                      {applying ? "Wird übernommen..." : "Geprüft und übernehmen"}
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Einreichung verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Antwort bleibt für die Nachvollziehbarkeit gespeichert, wird aber nicht in
              eine Patientenakte übernommen. Diese Aufnahme verschwindet aus der Arbeitsliste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discarding}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={discarding}
              onClick={(event) => {
                event.preventDefault()
                void handleDiscard()
              }}
            >
              {discarding ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Verwerfen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
