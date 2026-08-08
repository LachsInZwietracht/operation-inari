"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Search, Send, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { PatientIntakeInviteDialog } from "@/components/patient-intake-invite-dialog"
import { PatientIntakeReview } from "@/components/patient-intake-review"
import { PatientPipelineListRow } from "@/components/patient-pipeline-row"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useCounseling } from "@/hooks/use-counseling"
import { usePatientIntake } from "@/hooks/use-patient-intake"
import { usePatients } from "@/hooks/use-patients"
import { INDICATION_OPTIONS } from "@/lib/constants"
import {
  PATIENT_STATUS_META,
  PATIENT_STATUS_ORDER,
  buildPatientPipeline,
  countByStatus,
  type PatientPipelineRow,
  type PatientPipelineStatus,
  type PatientPlanSummary,
} from "@/lib/patient-status"
import type { CounselingSession, Patient } from "@/lib/types"

interface PatientenPageClientProps {
  initialPatients?: Patient[]
  initialSessions?: CounselingSession[]
  initialPlanSummaries?: PatientPlanSummary[]
}

type StatusFilter = PatientPipelineStatus | "alle"

export function PatientenPageClient({
  initialPatients,
  initialSessions,
  initialPlanSummaries = [],
}: PatientenPageClientProps) {
  const { patients } = usePatients({ initialPatients })
  const { sessions: counselingSessions } = useCounseling({ initialSessions })
  const { links, submissions, createLink, applySubmission } = usePatientIntake()

  const [search, setSearch] = useState("")
  const [indicationFilter, setIndicationFilter] = useState<string>("alle")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [reviewRow, setReviewRow] = useState<PatientPipelineRow | null>(null)
  const [applying, setApplying] = useState(false)

  const lastSessionByPatient = useMemo(() => {
    const map = new Map<string, string>()
    for (const session of counselingSessions) {
      const existing = map.get(session.patientId)
      if (!existing || session.date > existing) {
        map.set(session.patientId, session.date)
      }
    }
    return map
  }, [counselingSessions])

  // The whole list — patients and not-yet-applied invitations — in one shape.
  // This is what dissolves the old Onboarding tab.
  const rows = useMemo(
    () =>
      buildPatientPipeline({
        patients,
        links,
        submissions,
        planSummaries: initialPlanSummaries,
        lastSessionByPatient,
      }),
    [patients, links, submissions, initialPlanSummaries, lastSessionByPatient],
  )

  const counts = useMemo(() => countByStatus(rows), [rows])

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== "alle" && row.status !== statusFilter) return false

      if (indicationFilter !== "alle") {
        if (!row.patient?.indications?.includes(indicationFilter)) return false
      }

      if (!needle) return true
      const haystack = row.patient
        ? `${row.patient.firstName} ${row.patient.lastName} ${row.patient.lastName} ${row.patient.firstName}`
        : row.displayName
      return haystack.toLowerCase().includes(needle)
    })
  }, [rows, search, statusFilter, indicationFilter])

  async function handleApply() {
    const submission = reviewRow?.pendingSubmission
    if (!submission) return

    setApplying(true)
    try {
      await applySubmission(submission.id)
      toast.success("Angaben übernommen", {
        description: "Der Patient wurde angelegt bzw. aktualisiert.",
      })
      setReviewRow(null)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Übernahme fehlgeschlagen")
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Patienten"
        description="Einladen, prüfen, planen — alle Patienten und offenen Einladungen in einer Liste."
        helpText="Jeder Eintrag zeigt seinen Status im Ablauf: Antwort da, Bereit für Plan, Fällig, Eingeladen oder Plan aktiv. Offene Einladungen erscheinen als eigene Zeile, bis die Angaben übernommen sind."
      >
        <Button variant="outline" onClick={() => setInviteOpen(true)}>
          <Send className="mr-2 h-4 w-4" />
          Einladung senden
        </Button>
        <Button asChild>
          <Link href="/patienten/neu">
            <Plus className="mr-2 h-4 w-4" />
            Neuer Patient
          </Link>
        </Button>
      </PageHeader>

      {/* Status filters replace the old worklist tiles, which showed numbers
          nobody could click. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusFilterChip
          label="Alle"
          count={rows.length}
          active={statusFilter === "alle"}
          onClick={() => setStatusFilter("alle")}
        />
        {PATIENT_STATUS_ORDER.map((status) => (
          <StatusFilterChip
            key={status}
            label={PATIENT_STATUS_META[status].label}
            count={counts[status]}
            active={statusFilter === status}
            dotClassName={PATIENT_STATUS_META[status].dotClassName}
            onClick={() => setStatusFilter(statusFilter === status ? "alle" : status)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Patient oder Einladung suchen..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={indicationFilter} onValueChange={setIndicationFilter}>
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Indikationen filtern">
            <SelectValue placeholder="Indikation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Indikationen</SelectItem>
            {INDICATION_OPTIONS.map((indication) => (
              <SelectItem key={indication} value={indication}>
                {indication}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        {/* Both doors, always in the same place, never hunted for. */}
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">Neue Person aufnehmen</p>
            <p className="text-xs text-muted-foreground">
              Selbst anlegen, oder einen Fragebogen-Link schicken und die Angaben übernehmen.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Einladung
            </Button>
            <Button size="sm" asChild>
              <Link href="/patienten/neu">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Neuer Patient
              </Link>
            </Button>
          </div>
        </div>

        {visibleRows.length > 0 ? (
          visibleRows.map((row) => (
            <PatientPipelineListRow key={row.id} row={row} onReview={setReviewRow} />
          ))
        ) : (
          <div className="rounded-lg border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "Noch keine Patienten. Lege einen an oder verschicke eine Einladung."
              : "Kein Eintrag entspricht den Filtern."}
          </div>
        )}
      </div>

      <PatientIntakeInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreate={createLink}
      />

      <Dialog open={Boolean(reviewRow)} onOpenChange={(open) => !open && setReviewRow(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface StatusFilterChipProps {
  label: string
  count: number
  active: boolean
  dotClassName?: string
  onClick: () => void
}

function StatusFilterChip({
  label,
  count,
  active,
  dotClassName,
  onClick,
}: StatusFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
      }`}
    >
      {dotClassName && !active ? (
        <span className={`size-1.5 rounded-full ${dotClassName}`} aria-hidden="true" />
      ) : null}
      {label}
      <span className={active ? "opacity-80" : "text-muted-foreground"}>{count}</span>
    </button>
  )
}
