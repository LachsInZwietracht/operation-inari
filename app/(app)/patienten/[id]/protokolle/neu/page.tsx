"use client"

import { use } from "react"
import { PageHeader } from "@/components/page-header"
import { ProtocolForm } from "@/components/protocol-form"
import { useProtocols } from "@/hooks/use-protocols"
import { usePatients } from "@/hooks/use-patients"

export default function NeuesProtokollPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { getPatient } = usePatients()
  const { addProtocol } = useProtocols()
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
        title="Neues Ernährungsprotokoll"
        description={`${patient.firstName} ${patient.lastName}`}
      />
      <ProtocolForm patientId={id} onSubmit={addProtocol} />
    </div>
  )
}
