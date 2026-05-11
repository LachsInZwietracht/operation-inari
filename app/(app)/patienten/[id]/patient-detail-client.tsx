"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
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
      >
        <div className="flex flex-wrap gap-2">
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
      <PatientTabs patient={patient} initialData={resolvedInitialData} />
    </div>
  )
}
