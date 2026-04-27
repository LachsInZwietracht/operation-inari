"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Code,
  Clock,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Key,
  Upload,
  Webhook,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { API_ENDPOINT_PREVIEWS, INTEGRATION_PREVIEWS, WEBHOOK_EVENT_PREVIEWS } from "@/lib/content/ops-preview"
import { SUPPORTED_EXPORTS } from "@/lib/exports/constants"
import { formatDate } from "@/lib/format"
import type { ExportFormat, ExportJobRecord, ExportScope } from "@/lib/types"
import { downloadResponseFile } from "@/lib/utils"

const STATUS_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  abgeschlossen: { label: "Abgeschlossen", variant: "default" },
  "in Bearbeitung": { label: "In Bearbeitung", variant: "secondary" },
  fehlgeschlagen: { label: "Fehlgeschlagen", variant: "destructive" },
}

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  POST: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PUT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

export default function ApiExportPage() {
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null)
  const [exportScopes, setExportScopes] = useState<Record<ExportFormat, ExportScope>>({
    CSV: "Lebensmittel",
    JSON: "Rezepte",
    PDF: "Patienten",
  })
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all")
  const [historyFormatFilter, setHistoryFormatFilter] = useState("all")
  const [exportJobs, setExportJobs] = useState<ExportJobRecord[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState<Record<ExportFormat, boolean>>({
    CSV: false,
    JSON: false,
    PDF: false,
  })

  async function loadExportJobs() {
    try {
      const response = await fetch("/api/export-jobs", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const data = (await response.json()) as Array<{
        id: string
        user_id: string
        type: "export" | "import"
        format: ExportFormat
        scope: ExportScope
        status: "abgeschlossen" | "in Bearbeitung" | "fehlgeschlagen"
        created_at: string
        file_size?: string | null
        created_by: string
        file_name?: string | null
        parameters?: Record<string, unknown> | null
      }>
      setExportJobs(
        data.map((job) => ({
          id: job.id,
          userId: job.user_id,
          type: job.type,
          format: job.format,
          scope: job.scope,
          status: job.status,
          createdAt: job.created_at,
          fileSize: job.file_size ?? undefined,
          createdBy: job.created_by,
          fileName: job.file_name ?? undefined,
          parameters: job.parameters ?? undefined,
        })),
      )
      setHistoryError(null)
    } catch (error) {
      const message = (error as Error).message || "Export-Historie konnte nicht geladen werden"
      setHistoryError(message)
      toast.error(message)
    }
  }

  useEffect(() => {
    void loadExportJobs()
  }, [])

  async function handleExport(format: ExportFormat) {
    const scope = exportScopes[format]
    setIsExporting((prev) => ({ ...prev, [format]: true }))
    try {
      const response = await fetch("/api/exports/datasets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format, scope }),
      })
      await downloadResponseFile(response, `${scope.toLowerCase()}.${format.toLowerCase()}`)
      await loadExportJobs()
      toast.success(`${format}-Export erstellt`, {
        description: `${scope} wurde erfolgreich exportiert.`,
      })
    } catch (error) {
      toast.error((error as Error).message || "Export konnte nicht erstellt werden")
    } finally {
      setIsExporting((prev) => ({ ...prev, [format]: false }))
    }
  }

  const filteredHistory = useMemo(() => {
    return exportJobs.filter((job) => {
      if (historyTypeFilter !== "all" && job.type !== historyTypeFilter) return false
      if (historyFormatFilter !== "all" && job.format !== historyFormatFilter) return false
      return true
    })
  }, [exportJobs, historyFormatFilter, historyTypeFilter])

  const exportSummary = useMemo(() => {
    const exportsOnly = exportJobs.filter((job) => job.type === "export")
    const latestExport = exportsOnly[0]
    const distinctScopes = new Set(exportsOnly.map((job) => job.scope)).size
    const pdfExports = exportsOnly.filter((job) => job.format === "PDF").length

    return [
      {
        label: "Exporte insgesamt",
        value: exportsOnly.length.toString(),
        helper: distinctScopes > 0 ? `${distinctScopes} Bereiche genutzt` : "Noch keine Exporthistorie",
      },
      {
        label: "Letzter Export",
        value: latestExport ? formatDate(latestExport.createdAt) : "Noch keiner",
        helper: latestExport ? `${latestExport.scope} · ${latestExport.format}` : "Wird nach dem ersten Lauf erfasst",
      },
      {
        label: "PDF-Exporte",
        value: pdfExports.toString(),
        helper: "Patienten- und Berichtsdokumente",
      },
    ]
  }, [exportJobs])

  return (
    <div className="space-y-6">
      <PageHeader
        title="API & Export"
        description="Reale Datenausgabe plus klar gekennzeichnete API-/Integrationsvorschau"
        helpText="Die Exporterstellung und das Exportjournal laufen produktiv ueber Supabase. Externe REST-API, API-Schluessel und Webhooks sind in dieser Ansicht bewusst als Preview gekennzeichnet."
      />

      <Tabs defaultValue="export" className="space-y-4">
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="export" className="gap-1.5">
            <Download className="h-4 w-4" />
            Export
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-1.5">
            <Code className="h-4 w-4" />
            REST API
          </TabsTrigger>
          <TabsTrigger value="integrationen" className="gap-1.5">
            <Webhook className="h-4 w-4" />
            Integrationen
          </TabsTrigger>
          <TabsTrigger value="verlauf" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Verlauf
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-6">
          {historyError && (
            <Alert variant="destructive">
              <AlertTitle>Export-Historie nicht verfügbar</AlertTitle>
              <AlertDescription>
                Die Exportfunktionen bleiben nutzbar, aber das Journal konnte nicht geladen werden: {historyError}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {exportSummary.map((item) => (
              <Card key={item.label}>
                <CardContent className="pt-4">
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.helper}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {([
              { format: "CSV", icon: FileSpreadsheet, desc: "Tabellarische Daten fuer Excel und Datenbanken" },
              { format: "JSON", icon: FileJson, desc: "Strukturierte Daten fuer Entwickler:innen und Integrationen" },
              { format: "PDF", icon: FileText, desc: "Formatierte Berichte zum Drucken und Archivieren" },
            ] as const).map(({ format, icon: Icon, desc }) => (
              <Card key={format}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    {format}-Export
                  </CardTitle>
                  <CardDescription>{desc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select
                    value={exportScopes[format]}
                    onValueChange={(value) => setExportScopes((prev) => ({ ...prev, [format]: value as ExportScope }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Bereich waehlen" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_EXPORTS[format].map((scope) => (
                        <SelectItem key={scope} value={scope}>
                          {scope}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button className="w-full" onClick={() => void handleExport(format)} disabled={isExporting[format]}>
                    <Download className="mr-2 h-4 w-4" />
                    {isExporting[format] ? "Wird erstellt..." : "Exportieren"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  Datenimport
                </CardTitle>
                <Badge variant="secondary">Geplant</Badge>
              </div>
              <CardDescription>
                Das Import-Backend ist fuer diese Ops-Oberflaeche noch nicht implementiert.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                CSV- und JSON-Importe sollen spaeter mit Validierung, Dry-Run und Audit-Eintrag ueber denselben
                Export-/Ops-Bereich laufen.
              </p>
              <div className="rounded-lg border border-dashed p-4">
                Importvorschau: Dateiupload, Feldmapping und Fehlerbericht erscheinen erst mit einem echten Importservice.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  REST API Vorschau
                </CardTitle>
                <Badge variant="secondary">Preview</Badge>
              </div>
              <CardDescription>
                Export- und Berichtspipelines sind live, aber API-Key-Ausgabe und externer REST-Zugriff werden hier
                noch nicht produktiv verwaltet.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold">Keine live verwalteten API-Schluessel</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Token-Erstellung, Rotation und Widerruf werden erst mit einem echten Key-Backend freigeschaltet.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold">Schema-Vorschau verfuegbar</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Die untenstehenden Endpunkte zeigen das geplante Shape fuer künftige Integrationen.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold">Kein externer Supportvertrag</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Monitoring, Rate Limits und Mandantenmodell sind fuer die externe API noch nicht produktiv finalisiert.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Code className="h-5 w-5 text-muted-foreground" />
                Geplante Endpunkte
              </CardTitle>
              <CardDescription>Basis-URL und Antwortbeispiele sind Vorschau, keine freigeschaltete externe API.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table data-testid="api-endpoints-table" className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Methode</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Beschreibung</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {API_ENDPOINT_PREVIEWS.map((endpoint) => (
                      <Fragment key={endpoint.id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => setExpandedEndpoint((current) => (current === endpoint.id ? null : endpoint.id))}
                        >
                          <TableCell>
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${METHOD_STYLES[endpoint.method] ?? ""}`}>
                              {endpoint.method}
                            </span>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm">{endpoint.route}</code>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{endpoint.description}</TableCell>
                          <TableCell>
                            {expandedEndpoint === endpoint.id ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedEndpoint === endpoint.id ? (
                          <TableRow>
                            <TableCell colSpan={4} className="bg-muted/30 p-0">
                              <div className="p-4">
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Beispielantwort (Preview)</p>
                                <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
                                  {JSON.stringify(endpoint.sampleResponse, null, 2)}
                                </pre>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrationen" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Webhook className="h-5 w-5 text-muted-foreground" />
                  Integrationsvorschau
                </CardTitle>
                <Badge variant="secondary">Preview</Badge>
              </div>
              <CardDescription>
                Diese Oberflaeche dokumentiert das Zielbild. Aktivierung, Webhook-Zustellung und Credential-Verwaltung
                sind noch kein produktiver Backend-Workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {INTEGRATION_PREVIEWS.map((integration) => (
                <div key={integration.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{integration.label}</p>
                    <Badge variant="outline">{integration.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{integration.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhook-Ereignisse</CardTitle>
              <CardDescription>
                Ereignisnamen und Payload-Richtung sind dokumentiert, aber noch nicht an eine persistierte
                Webhook-Verwaltung gekoppelt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table data-testid="webhook-table" className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ereignis</TableHead>
                      <TableHead>Beschreibung</TableHead>
                      <TableHead>Zustellung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {WEBHOOK_EVENT_PREVIEWS.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <code className="text-xs">{event.event}</code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{event.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{event.delivery}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verlauf" className="space-y-4">
          {historyError && (
            <Alert variant="destructive">
              <AlertTitle>Export-Journal konnte nicht geladen werden</AlertTitle>
              <AlertDescription>{historyError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={historyTypeFilter} onValueChange={setHistoryTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Typ filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="export">Export</SelectItem>
                <SelectItem value="import">Import</SelectItem>
              </SelectContent>
            </Select>
            <Select value={historyFormatFilter} onValueChange={setHistoryFormatFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Format filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Formate</SelectItem>
                <SelectItem value="CSV">CSV</SelectItem>
                <SelectItem value="JSON">JSON</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
              </SelectContent>
            </Select>
            <p className="self-center text-sm text-muted-foreground">{filteredHistory.length} Eintraege</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Typ</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Bereich</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Erstellt am</TableHead>
                      <TableHead>Groesse</TableHead>
                      <TableHead>Erstellt von</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((job) => {
                      const meta = STATUS_STYLES[job.status]
                      return (
                        <TableRow key={job.id}>
                          <TableCell>
                            <Badge variant={job.type === "export" ? "default" : "secondary"}>
                              {job.type === "export" ? "Export" : "Import"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{job.format}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{job.scope}</TableCell>
                          <TableCell>
                            <Badge variant={meta?.variant ?? "secondary"}>{meta?.label ?? job.status}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(job.createdAt)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{job.fileSize ?? "–"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{job.createdBy}</TableCell>
                        </TableRow>
                      )
                    })}
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          Keine Eintraege gefunden.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
