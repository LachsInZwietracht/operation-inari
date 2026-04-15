"use client"

import { use } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { ProtocolForm } from "@/components/protocol-form"
import { useProtocols } from "@/hooks/use-protocols"
import { usePatients } from "@/hooks/use-patients"
import { useFoods } from "@/components/foods-provider"

export function NeuesProtokollPageClient({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const templateId = searchParams.get("template") ?? undefined
  const { getPatient } = usePatients()
  const foods = useFoods()
  const { addProtocol } = useProtocols(foods)
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
      <ProtocolForm patientId={id} templateId={templateId} onSubmit={addProtocol} />
    </div>
  )
}
