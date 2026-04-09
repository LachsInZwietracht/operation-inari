"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCounseling } from "@/hooks/use-counseling"
import { usePatients } from "@/hooks/use-patients"
import { formatDate } from "@/lib/format"

export default function BeratungDetailPage({
  params,
}: {
  params: Promise<{ id: string; beratungId: string }>
}) {
  const { id, beratungId } = use(params)
  const { getPatient } = usePatients()
  const { getSession } = useCounseling()

  const patient = getPatient(id)
  const session = getSession(beratungId)

  if (!patient || !session) {
    return (
      <div className="space-y-6">
        <PageHeader title="Nicht gefunden" />
        <p className="text-sm text-muted-foreground">
          Beratung oder Patient wurde nicht gefunden.
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

      <PageHeader
        title={`${session.type} – ${session.indication}`}
      >
        <Badge variant="outline">{session.duration} Min.</Badge>
      </PageHeader>

      <div className="text-sm text-muted-foreground">
        {formatDate(session.date)}
      </div>

      {session.goals && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Beratungsziele</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{session.goals}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dokumentation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
            {session.content}
          </div>
        </CardContent>
      </Card>

      {session.recommendations && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empfehlungen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{session.recommendations}</p>
          </CardContent>
        </Card>
      )}

      {session.nextAppointment && (
        <Card>
          <CardContent className="flex items-center gap-2 pt-6">
            <span className="text-sm font-medium">Nächster Termin:</span>
            <span className="text-sm">{formatDate(session.nextAppointment)}</span>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
