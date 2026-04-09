"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AnthropometricChart } from "@/components/anthropometric-chart"
import { AnthropometricForm } from "@/components/anthropometric-form"
import { formatDate, formatNumber } from "@/lib/format"
import { useAnthropometric } from "@/hooks/use-anthropometric"
import { COUNSELING_SESSIONS, PROTOCOLS } from "@/lib/mock-data"
import { PROTOCOL_TYPE_LABELS } from "@/lib/constants"
import type { Patient } from "@/lib/types"

interface PatientTabsProps {
  patient: Patient
}

export function PatientTabs({ patient }: PatientTabsProps) {
  const { getForPatient, addEntry } = useAnthropometric()
  const [showAnthroForm, setShowAnthroForm] = useState(false)

  const anthroEntries = getForPatient(patient.id)
  const sessions = COUNSELING_SESSIONS.filter((s) => s.patientId === patient.id)
  const protocols = PROTOCOLS.filter((p) => p.patientId === patient.id)

  const latestAnthro = anthroEntries.length > 0 ? anthroEntries[anthroEntries.length - 1] : null

  return (
    <Tabs defaultValue="stammdaten">
      <TabsList>
        <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
        <TabsTrigger value="anthropometrie">Anthropometrie</TabsTrigger>
        <TabsTrigger value="protokolle">Protokolle</TabsTrigger>
        <TabsTrigger value="beratungen">Beratungen</TabsTrigger>
      </TabsList>

      <TabsContent value="stammdaten" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Persönliche Daten</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Geburtsdatum</dt>
                <dd className="text-sm font-medium">{formatDate(patient.dateOfBirth)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Geschlecht</dt>
                <dd className="text-sm font-medium">
                  {patient.gender === "m" ? "Männlich" : patient.gender === "w" ? "Weiblich" : "Divers"}
                </dd>
              </div>
              {patient.email && (
                <div>
                  <dt className="text-sm text-muted-foreground">E-Mail</dt>
                  <dd className="text-sm font-medium">{patient.email}</dd>
                </div>
              )}
              {patient.phone && (
                <div>
                  <dt className="text-sm text-muted-foreground">Telefon</dt>
                  <dd className="text-sm font-medium">{patient.phone}</dd>
                </div>
              )}
              {patient.street && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">Adresse</dt>
                  <dd className="text-sm font-medium">
                    {patient.street}, {patient.zip} {patient.city}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Versicherung & Medizinisches</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {patient.insuranceProvider && (
                <div>
                  <dt className="text-sm text-muted-foreground">Krankenkasse</dt>
                  <dd className="text-sm font-medium">{patient.insuranceProvider}</dd>
                </div>
              )}
              {patient.insuranceNumber && (
                <div>
                  <dt className="text-sm text-muted-foreground">Versichertennummer</dt>
                  <dd className="text-sm font-medium">{patient.insuranceNumber}</dd>
                </div>
              )}
              {patient.indication && (
                <div>
                  <dt className="text-sm text-muted-foreground">Indikation</dt>
                  <dd className="text-sm font-medium">
                    <Badge variant="secondary">{patient.indication}</Badge>
                  </dd>
                </div>
              )}
            </dl>
            {patient.notes && (
              <div className="mt-4">
                <dt className="text-sm text-muted-foreground">Notizen</dt>
                <dd className="mt-1 text-sm whitespace-pre-wrap">{patient.notes}</dd>
              </div>
            )}
          </CardContent>
        </Card>

        {latestAnthro && (
          <Card>
            <CardHeader>
              <CardTitle>Aktuelle Messwerte</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-4">
                <div>
                  <dt className="text-sm text-muted-foreground">Gewicht</dt>
                  <dd className="text-lg font-semibold">{formatNumber(latestAnthro.weight, 1)} kg</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Größe</dt>
                  <dd className="text-lg font-semibold">{formatNumber(latestAnthro.height, 0)} cm</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">BMI</dt>
                  <dd className="text-lg font-semibold">{formatNumber(latestAnthro.bmi, 1)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Datum</dt>
                  <dd className="text-lg font-semibold">{formatDate(latestAnthro.date)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="anthropometrie" className="space-y-4">
        {anthroEntries.length > 1 && (
          <AnthropometricChart entries={anthroEntries} />
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Messwerte</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnthroForm(!showAnthroForm)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Neue Messung
            </Button>
          </CardHeader>
          <CardContent>
            {showAnthroForm && (
              <div className="mb-6 rounded-lg border p-4">
                <AnthropometricForm
                  patientId={patient.id}
                  defaultHeight={latestAnthro?.height}
                  onSubmit={(entry) => {
                    addEntry(entry)
                    setShowAnthroForm(false)
                  }}
                  onCancel={() => setShowAnthroForm(false)}
                />
              </div>
            )}

            {anthroEntries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Gewicht (kg)</TableHead>
                    <TableHead className="text-right">Größe (cm)</TableHead>
                    <TableHead className="text-right">BMI</TableHead>
                    <TableHead className="text-right">Bauchumfang (cm)</TableHead>
                    <TableHead className="text-right">Körperfett (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...anthroEntries].reverse().map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell className="text-right">{formatNumber(entry.weight, 1)}</TableCell>
                      <TableCell className="text-right">{formatNumber(entry.height, 0)}</TableCell>
                      <TableCell className="text-right">{formatNumber(entry.bmi, 1)}</TableCell>
                      <TableCell className="text-right">
                        {entry.waistCircumference ? formatNumber(entry.waistCircumference, 0) : "–"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.bodyFatPercentage ? formatNumber(entry.bodyFatPercentage, 1) : "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Noch keine Messwerte vorhanden.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="protokolle" className="space-y-4">
        <div className="flex justify-end">
          <Button asChild>
            <Link href={`/patienten/${patient.id}/protokolle/neu`}>
              <Plus className="mr-2 h-4 w-4" />
              Neues Protokoll
            </Link>
          </Button>
        </div>

        {protocols.length > 0 ? (
          <div className="grid gap-4">
            {protocols.map((protocol) => (
              <Link key={protocol.id} href={`/patienten/${patient.id}/protokolle/${protocol.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{protocol.title}</CardTitle>
                      <Badge variant="secondary">
                        {PROTOCOL_TYPE_LABELS[protocol.type]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>
                      {formatDate(protocol.startDate)} – {formatDate(protocol.endDate)}
                      {" · "}{protocol.days.length} {protocol.days.length === 1 ? "Tag" : "Tage"}
                    </p>
                    {protocol.notes && (
                      <p className="mt-1 line-clamp-1">{protocol.notes}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Ernährungsprotokolle vorhanden.
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="beratungen" className="space-y-4">
        <div className="flex justify-end">
          <Button asChild>
            <Link href={`/patienten/${patient.id}/beratungen/neu`}>
              <Plus className="mr-2 h-4 w-4" />
              Neue Beratung
            </Link>
          </Button>
        </div>

        {sessions.length > 0 ? (
          <div className="grid gap-4">
            {sessions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((session) => (
                <Link
                  key={session.id}
                  href={`/patienten/${patient.id}/beratungen/${session.id}`}
                >
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">
                          {session.type} – {session.indication}
                        </CardTitle>
                        <Badge variant="outline">{session.duration} Min.</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <p>{formatDate(session.date)}</p>
                      {session.goals && (
                        <p className="mt-1 line-clamp-1">{session.goals}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Beratungssitzungen vorhanden.
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  )
}
