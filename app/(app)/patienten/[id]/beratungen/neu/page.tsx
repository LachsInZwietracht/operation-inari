"use client"

import { use } from "react"
import { PageHeader } from "@/components/page-header"
import { CounselingSessionForm } from "@/components/counseling-session-form"
import { useCounseling } from "@/hooks/use-counseling"
import { usePatients } from "@/hooks/use-patients"

export default function NeueBeratungPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { getPatient } = usePatients()
  const { addSession } = useCounseling()
  const patient = getPatient(id)

  if (!patient) {
    return (
      <div className="space-y-6">
        <PageHeader title="Patient nicht gefunden" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Neue Beratungssitzung"
        description={`${patient.firstName} ${patient.lastName}`}
      />
      <CounselingSessionForm
        patientId={id}
        defaultIndication={patient.indication}
        onSubmit={addSession}
      />
    </div>
  )
}
