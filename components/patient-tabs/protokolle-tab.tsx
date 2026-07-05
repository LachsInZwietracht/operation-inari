"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { CheckCircle2, ChevronDown, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/format"
import { PROTOCOL_TYPE_LABELS } from "@/lib/constants"
import type {
  DigitalProtocolLink,
  DigitalProtocolSubmission,
  NutritionProtocol,
  Patient,
} from "@/lib/types"

const GuidedProtocolAssistant = dynamic(
  () => import("@/components/guided-protocol-assistant").then((mod) => mod.GuidedProtocolAssistant),
  { ssr: false },
)

interface ComparisonMetric {
  key: string
  label: string
  unit: string
}

interface ProtokolleTabProps {
  patient: Patient
  protocols: NutritionProtocol[]
  protocolComparison: NutritionProtocol[]
  comparisonMetrics: ComparisonMetric[]
  digitalMethod: string
  setDigitalMethod: (value: string) => void
  digitalMethodOptions: string[]
  onGenerateLink: () => void
  digitalLinks: DigitalProtocolLink[]
  digitalLinksPending: boolean
  onUpdateLinkStatus: (id: string, status: DigitalProtocolLink["status"]) => void
  digitalSubmissions: DigitalProtocolSubmission[]
  isLoadingSubmissions: boolean
  onMarkSubmissionReviewed: (submissionId: string) => void
}

export function ProtokolleTab({
  patient,
  protocols,
  protocolComparison,
  comparisonMetrics,
  digitalMethod,
  setDigitalMethod,
  digitalMethodOptions,
  onGenerateLink,
  digitalLinks,
  digitalLinksPending,
  onUpdateLinkStatus,
  digitalSubmissions,
  isLoadingSubmissions,
  onMarkSubmissionReviewed,
}: ProtokolleTabProps) {
  return (
    <>
      <TabsList>
        <TabsTrigger value="ernaehrungsplaene">Ernährungspläne</TabsTrigger>
        <TabsTrigger value="protokolle">Protokolle</TabsTrigger>
      </TabsList>
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

      <GuidedProtocolAssistant patientId={patient.id} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Digitale Protokolle</CardTitle>
            <CardDescription>Links für Patientenselbst-Erfassung.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={digitalMethod} onValueChange={setDigitalMethod}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {digitalMethodOptions.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={onGenerateLink}>
              Link erstellen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {digitalLinks.length > 0 ? (
            digitalLinks.map((link) => (
              <div
                key={link.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{link.method}</p>
                  <p className="text-muted-foreground text-xs truncate max-w-[250px]">{link.url}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={link.status === "received" ? "secondary" : link.status === "pending" ? "outline" : "destructive"}
                    className={
                      link.status === "received"
                        ? "border-emerald-200 text-emerald-700"
                        : link.status === "pending"
                          ? "border-amber-200 text-amber-700"
                          : "border-rose-200 text-rose-700"
                    }
                  >
                    {link.status === "received"
                      ? "eingetroffen"
                      : link.status === "pending"
                        ? "ausstehend"
                        : "abgelaufen"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onUpdateLinkStatus(
                        link.id,
                        link.status === "pending"
                          ? "received"
                          : link.status === "received"
                            ? "expired"
                            : "pending",
                      )
                    }
                  >
                    Status toggeln
                  </Button>
                </div>
              </div>
            ))
          ) : digitalLinksPending ? (
            <p className="text-sm text-muted-foreground">Digitale Protokolle werden synchronisiert.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine digitalen Protokolle generiert.</p>
          )}

          {/* Submissions section */}
          {digitalSubmissions.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium">Eingereichte Protokolle</h4>
              {digitalSubmissions.map((submission) => (
                <Collapsible key={submission.id}>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm">
                      <ChevronDown className="h-4 w-4" />
                      <span>{new Date(submission.submittedAt).toLocaleDateString("de-DE")}</span>
                      <Badge
                        variant="outline"
                        className={
                          submission.status === "new"
                            ? "border-blue-200 text-blue-700"
                            : submission.status === "reviewed"
                              ? "border-emerald-200 text-emerald-700"
                              : "border-purple-200 text-purple-700"
                        }
                      >
                        {submission.status === "new"
                          ? "neu"
                          : submission.status === "reviewed"
                            ? "geprüft"
                            : "übernommen"}
                      </Badge>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-2">
                      {(submission.status === "new" || submission.status === "reviewed") && (
                        <Button size="sm" variant="secondary" asChild>
                          <Link
                            href={`/patienten/${patient.id}/protokolle/neu?digitalSubmission=${submission.id}`}
                          >
                            In Entwurf uebernehmen
                          </Link>
                        </Button>
                      )}
                      {submission.status === "new" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarkSubmissionReviewed(submission.id)}
                        >
                          Als geprüft markieren
                        </Button>
                      )}
                      {submission.status === "converted" && submission.convertedProtocolId && (
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            href={`/patienten/${patient.id}/protokolle/${submission.convertedProtocolId}`}
                          >
                            Protokoll oeffnen
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                  <CollapsibleContent className="mt-1 space-y-2 px-3 pb-2">
                    {(submission.days ?? []).map((day, dayIdx) => (
                      <div key={dayIdx} className="rounded border p-2 text-sm">
                        <p className="font-medium">{day.date}</p>
                        {(day.entries ?? []).map((entry, entryIdx) => (
                          <div key={entryIdx} className="mt-1 ml-2">
                            <span className="text-muted-foreground">{entry.mealSlot}:</span>{" "}
                            {entry.freeText}
                            {entry.time && (
                              <span className="text-muted-foreground ml-1">({entry.time})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    {submission.notes && (
                      <p className="text-sm text-muted-foreground">
                        Anmerkungen: {submission.notes}
                      </p>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
          {isLoadingSubmissions && digitalSubmissions.length === 0 && (
            <p className="text-sm text-muted-foreground">Einreichungen werden geladen.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Protokollvergleich & Compliance</CardTitle>
          <CardDescription>Mock-Vergleich zweier Protokolle inkl. Deckungsgrad.</CardDescription>
        </CardHeader>
        <CardContent>
          {protocolComparison.length >= 2 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {protocolComparison.map((protocol, index) => (
                <div key={protocol.id} className="rounded-lg border p-3">
                  <p className="font-semibold">{protocol.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {protocol.days.length} Tage · {formatDate(protocol.startDate)}
                  </p>
                  <div className="mt-3 space-y-2">
                    {comparisonMetrics.map((metric, metricIndex) => {
                      const baseScore = Math.min(
                        120,
                        protocol.days.length * 10 + metricIndex * 5 + index * 8,
                      )
                      return (
                        <div key={metric.key}>
                          <div className="flex items-center justify-between text-xs">
                            <span>{metric.label}</span>
                            <span>{baseScore}% Ziel</span>
                          </div>
                          <Progress value={baseScore} className="mt-1" />
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">
                      Deckung {Math.min(110, protocol.days.length * 12 + index * 5)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Mindestens zwei Protokolle erforderlich für den Abgleich.</p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
