"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAppBreadcrumb } from "@/components/app-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { IntakeStageProgress } from "@/components/intake-stage-progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { usePatients } from "@/hooks/use-patients"
import { useAuth } from "@/hooks/use-auth"
import type { PatientWorkspaceData } from "@/lib/data/patient-workspace"
import {
  derivePatientIntakeStage,
  INTAKE_STAGE_META,
  type IntakeStage,
} from "@/lib/patient-journey"

const PatientTabs = dynamic(
  () => import("@/components/patient-tabs").then((mod) => mod.PatientTabs),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="h-10 rounded-md bg-muted/50" />
        <div className="h-[360px] rounded-md bg-muted/40" />
      </div>
    ),
  },
)

function getPatientDescription(patient: { indication?: string; indications?: string[] }) {
  return patient.indications?.length ? patient.indications.join(" · ") : patient.indication
}

export function PatientDetailClient({
  patientId,
  initialData,
}: {
  patientId: string
  initialData?: PatientWorkspaceData | null
}) {
  const router = useRouter()
  const { getPatient, deletePatient, isLoadingRemote } = usePatients({
    initialPatients: initialData?.patient ? initialData.patients : undefined,
  })
  const { loading: authLoading, isAuthenticated } = useAuth()
  const [isDeleting, setIsDeleting] = useState(false)
  const [newMeasurementRequest, setNewMeasurementRequest] = useState<number>()
  const patient = initialData?.patient ?? getPatient(patientId)
  const resolvedInitialData = initialData?.patient ? initialData : undefined
  // The URL only carries the uuid, so the header trail would otherwise stop at
  // "Patienten". This is the only place that knows whose record this is.
  useAppBreadcrumb(
    patient
      ? [
          { label: "Patienten", href: "/patienten" },
          { label: `${patient.firstName} ${patient.lastName}` },
        ]
      : null,
  )
  // The phase belongs next to the name: it is the one fact that decides what to
  // do next, and the header is what gets read first. Seeded from the server
  // payload so it does not pop in, then kept current by the tabs, which own the
  // live workspace hooks. The server copy can be empty when the patient only
  // resolves client-side, which is why this cannot simply be derived here.
  const [stage, setStage] = useState<IntakeStage | null>(() =>
    resolvedInitialData && initialData?.patient
      ? derivePatientIntakeStage({
          patient: initialData.patient,
          links: resolvedInitialData.intakeLinks,
          submissions: resolvedInitialData.intakeSubmissions,
          sessions: resolvedInitialData.counselingSessions,
          appointments: resolvedInitialData.appointments,
        })
      : null,
  )
  const handleStageChange = useCallback((next: IntakeStage) => {
    setStage((previous) => (previous === next ? previous : next))
  }, [])
  const stageMeta = stage ? INTAKE_STAGE_META[stage] : null

  if (!patient && (authLoading || (isAuthenticated && isLoadingRemote))) {
    return (
      <div className="space-y-6">
        <PageHeader title="Patient wird geladen" />
        <p className="text-sm text-muted-foreground">
          Die Patientendaten werden aus der Cloud synchronisiert.
        </p>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="space-y-6">
        <PageHeader title="Patient nicht gefunden" />
        <p className="text-sm text-muted-foreground">
          Der angeforderte Patient wurde nicht gefunden.
        </p>
      </div>
    )
  }

  const handleDeletePatient = async () => {
    setIsDeleting(true)
    const deleted = await deletePatient(patient.id)
    setIsDeleting(false)

    if (!deleted) {
      toast.error("Patient konnte nicht gelöscht werden.")
      return
    }

    toast.success("Patient gelöscht.")
    router.push("/patienten")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        description={getPatientDescription(patient)}
        leading={
          stageMeta ? (
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: stageMeta.color }}
              aria-hidden="true"
            />
          ) : undefined
        }
        titleSuffix={
          stage && stageMeta ? (
            <span className="flex items-center gap-2">
              <Badge style={{ backgroundColor: stageMeta.color, color: "white" }}>
                {stageMeta.label}
              </Badge>
              <IntakeStageProgress stage={stage} />
            </span>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setNewMeasurementRequest(Date.now())}>
            <Plus className="mr-2 h-4 w-4" />
            Messwerte hinzufügen
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/patienten/${patient.id}/bearbeiten`}>
              <Pencil className="mr-2 h-4 w-4" />
              Bearbeiten
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Patient löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  {patient.firstName} {patient.lastName} wird aus der Patientenliste entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isDeleting}
                  onClick={(event) => {
                    event.preventDefault()
                    void handleDeletePatient()
                  }}
                >
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PageHeader>
      <PatientTabs
        patient={patient}
        initialData={resolvedInitialData}
        newMeasurementRequest={newMeasurementRequest}
        onStageChange={handleStageChange}
      />
    </div>
  )
}
