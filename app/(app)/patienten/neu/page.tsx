"use client"

import { PageHeader } from "@/components/page-header"
import { PatientForm } from "@/components/patient-form"
import { usePatients } from "@/hooks/use-patients"

export default function NeuerPatientPage() {
  const { addPatient } = usePatients()

  return (
    <div className="space-y-6">
      <PageHeader title="Neuer Patient" description="Patient anlegen" />
      <PatientForm onSubmit={addPatient} />
    </div>
  )
}
