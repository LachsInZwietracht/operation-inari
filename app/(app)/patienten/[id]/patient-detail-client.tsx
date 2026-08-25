"use client"

import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { useAppBreadcrumb } from "@/components/app-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { IntakeStageProgress } from "@/components/intake-stage-progress"
import { Badge } from "@/components/ui/badge"
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
    const deleted = await deletePatient(patient.id)

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
      />
      <PatientTabs
        patient={patient}
        initialData={resolvedInitialData}
        onDeletePatient={handleDeletePatient}
        onStageChange={handleStageChange}
      />
    </div>
  )
}
