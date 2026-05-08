"use client"

import { use } from "react"
import { PageHeader } from "@/components/page-header"
import { PatientForm } from "@/components/patient-form"
import { usePatients } from "@/hooks/use-patients"

export default function PatientBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { getPatient, updatePatient, patients } = usePatients()
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
        title="Patient bearbeiten"
        description={`${patient.firstName} ${patient.lastName}`}
      />
      <PatientForm
        patient={patient}
        isEditing
        existingPatients={patients}
        onSubmit={(values) => updatePatient(patient.id, values)}
      />
    </div>
  )
}
