"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Pencil } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { usePatients } from "@/hooks/use-patients"
import { useAuth } from "@/hooks/use-auth"
import type { PatientWorkspaceData } from "@/lib/data/patient-workspace"

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

export function PatientDetailClient({
  patientId,
  initialData,
}: {
  patientId: string
  initialData?: PatientWorkspaceData | null
}) {
  const { getPatient, isLoadingRemote } = usePatients({
    initialPatients: initialData?.patient ? initialData.patients : undefined,
  })
  const { loading: authLoading, isAuthenticated } = useAuth()
  const patient = initialData?.patient ?? getPatient(patientId)
  const resolvedInitialData = initialData?.patient ? initialData : undefined

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        description={patient.indication ?? undefined}
      >
        <Button variant="outline" asChild>
          <Link href={`/patienten/${patient.id}/bearbeiten`}>
            <Pencil className="mr-2 h-4 w-4" />
            Bearbeiten
          </Link>
        </Button>
      </PageHeader>
      <PatientTabs patient={patient} initialData={resolvedInitialData} />
    </div>
  )
}
