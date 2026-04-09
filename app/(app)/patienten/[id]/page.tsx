"use client"

import { use } from "react"
import Link from "next/link"
import { Pencil } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { PatientTabs } from "@/components/patient-tabs"
import { Button } from "@/components/ui/button"
import { usePatients } from "@/hooks/use-patients"

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { getPatient } = usePatients()
  const patient = getPatient(id)

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
      <PatientTabs patient={patient} />
    </div>
  )
}
