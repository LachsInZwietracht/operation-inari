"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ProtocolDayView } from "@/components/protocol-day-view"
import { ProtocolAnalysis } from "@/components/protocol-analysis"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useProtocols } from "@/hooks/use-protocols"
import { usePatients } from "@/hooks/use-patients"
import { PROTOCOL_TYPE_LABELS } from "@/lib/constants"
import { formatDate } from "@/lib/format"

export default function ProtokollDetailPage({
  params,
}: {
  params: Promise<{ id: string; protokollId: string }>
}) {
  const { id, protokollId } = use(params)
  const { getPatient } = usePatients()
  const { getProtocol } = useProtocols()

  const patient = getPatient(id)
  const protocol = getProtocol(protokollId)

  if (!patient || !protocol) {
    return (
      <div className="space-y-6">
        <PageHeader title="Nicht gefunden" />
        <p className="text-sm text-muted-foreground">
          Protokoll oder Patient wurde nicht gefunden.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/patienten/${id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zu {patient.firstName} {patient.lastName}
        </Link>
      </Button>

      <PageHeader title={protocol.title}>
        <Badge variant="secondary">
          {PROTOCOL_TYPE_LABELS[protocol.type]}
        </Badge>
      </PageHeader>

      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Zeitraum: {formatDate(protocol.startDate)} – {formatDate(protocol.endDate)}</span>
        <span>{protocol.days.length} {protocol.days.length === 1 ? "Tag" : "Tage"}</span>
      </div>

      {protocol.notes && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm whitespace-pre-wrap">{protocol.notes}</p>
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-semibold">Tagesübersicht</h2>
      {protocol.days.map((day) => (
        <ProtocolDayView key={day.date} day={day} />
      ))}

      <h2 className="text-lg font-semibold">Nährstoffanalyse</h2>
      <ProtocolAnalysis protocol={protocol} gender={patient.gender} />
    </div>
  )
}
