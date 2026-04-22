"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Download,
  Upload,
  Key,
  Code,
  Webhook,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  FileJson,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Circle,
  Clock,
  Loader2,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  API_ENDPOINTS,
  API_KEYS,
  WEBHOOK_CONFIGS,
  INTEGRATION_TOGGLES,
} from "@/lib/mock-data"
import { formatDate } from "@/lib/format"
import type { ExportFormat, ExportJobRecord, ExportScope } from "@/lib/types"
import { SUPPORTED_EXPORTS } from "@/lib/exports/constants"
import { downloadResponseFile } from "@/lib/utils"

const EXPORT_SCOPES: ExportScope[] = ["Lebensmittel", "Rezepte", "Patienten", "Ernährungspläne", "Berichte"]

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  POST: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PUT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

const STATUS_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  abgeschlossen: { label: "Abgeschlossen", variant: "default" },
  "in Bearbeitung": { label: "In Bearbeitung", variant: "secondary" },
  fehlgeschlagen: { label: "Fehlgeschlagen", variant: "destructive" },
}

export default function ApiExportPage() {
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null)
  const [exportScopes, setExportScopes] = useState<Record<ExportFormat, ExportScope>>({
    CSV: "Lebensmittel",
    JSON: "Rezepte",
    PDF: "Patienten",
  })
  const [importFormat, setImportFormat] = useState("CSV")
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all")
  const [historyFormatFilter, setHistoryFormatFilter] = useState("all")
  const [exportJobs, setExportJobs] = useState<ExportJobRecord[]>([])
  const [isExporting, setIsExporting] = useState<Record<ExportFormat, boolean>>({
    CSV: false,
    JSON: false,
    PDF: false,
  })
  const [integrationStates, setIntegrationStates] = useState<Record<string, boolean>>(
    Object.fromEntries(INTEGRATION_TOGGLES.map((t) => [t.id, t.enabled]))
  )
  const [webhookStates, setWebhookStates] = useState<Record<string, boolean>>(
    Object.fromEntries(WEBHOOK_CONFIGS.map((w) => [w.id, w.enabled]))
  )
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({})

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
    } catch (error) {
      toast.error((error as Error).message || "Export-Historie konnte nicht geladen werden")
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

  function handleImport() {
    toast.info("Import wird verarbeitet", {
      description: `${importFormat}-Datei wird analysiert und importiert.`,
    })
  }

  function handleCopyKey(key: string) {
    navigator.clipboard.writeText(key)
    toast.success("API-Schlüssel kopiert")
  }

  function handleToggleIntegration(id: string, enabled: boolean) {
    setIntegrationStates((prev) => ({ ...prev, [id]: enabled }))
    toast.success(enabled ? "Integration aktiviert" : "Integration deaktiviert")
  }

  function handleToggleWebhook(id: string, enabled: boolean) {
    setWebhookStates((prev) => ({ ...prev, [id]: enabled }))
    toast.success(enabled ? "Webhook aktiviert" : "Webhook deaktiviert")
  }

  const filteredHistory = useMemo(() => exportJobs.filter((job) => {
    if (historyTypeFilter !== "all" && job.type !== historyTypeFilter) return false
    if (historyFormatFilter !== "all" && job.format !== historyFormatFilter) return false
    return true
  }), [exportJobs, historyTypeFilter, historyFormatFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="API & Export"
        description="Daten exportieren, API-Zugriff verwalten und Integrationen konfigurieren"
        helpText="Exportieren Sie Ihre Daten in verschiedenen Formaten, verwalten Sie API-Schlüssel für Drittanbieter-Integrationen und konfigurieren Sie automatische Datenübertragungen."
      />

      <Tabs defaultValue="export" className="space-y-4">
        <TabsList>
          <TabsTrigger value="export" className="gap-1.5">
            <Download className="h-4 w-4" />
            Export & Import
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

        {/* ── Export & Import ── */}
        <TabsContent value="export" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {([
              { format: "CSV", icon: FileSpreadsheet, desc: "Tabellarische Daten für Excel und Datenbanken" },
              { format: "JSON", icon: FileJson, desc: "Strukturierte Daten für Entwickler und APIs" },
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
                    onValueChange={(v) => setExportScopes((prev) => ({ ...prev, [format]: v as ExportScope }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Bereich wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_EXPORTS[format as ExportFormat].map((scope) => (
                        <SelectItem key={scope} value={scope}>{scope}</SelectItem>
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
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-5 w-5 text-muted-foreground" />
                Daten importieren
              </CardTitle>
              <CardDescription>CSV- oder JSON-Dateien hochladen, um Daten zu importieren</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Select value={importFormat} onValueChange={setImportFormat}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CSV">CSV</SelectItem>
                    <SelectItem value="JSON">JSON</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="Lebensmittel">
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Zielbereich" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_SCOPES.map((scope) => (
                      <SelectItem key={scope} value={scope}>{scope}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div
                className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
                onClick={handleImport}
              >
                <Upload className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Datei hierhin ziehen oder klicken zum Auswählen</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Unterstützt: .csv, .json (max. 50 MB)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── REST API ── */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  API-Schlüssel
                </CardTitle>
                <CardDescription>Verwalten Sie Ihre API-Schlüssel für den programmatischen Zugriff</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => toast.success("Neuer API-Schlüssel erstellt", { description: "pk_live_****neu1" })}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Neuer Schlüssel
              </Button>
            </CardHeader>
            <CardContent>
              <Table data-testid="api-keys-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>Schlüssel</TableHead>
                    <TableHead>Berechtigungen</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead>Letzte Nutzung</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {API_KEYS.map((apiKey) => (
                    <TableRow key={apiKey.id}>
                      <TableCell className="font-medium">{apiKey.label}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {revealedKeys[apiKey.id] ? apiKey.key.replace(/\*{4}/, "7f3e") : apiKey.key}
                          </code>
                          {apiKey.status === "aktiv" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setRevealedKeys((prev) => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                              >
                                {revealedKeys[apiKey.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleCopyKey(apiKey.key)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {apiKey.scopes.map((scope) => (
                            <Badge key={scope} variant="outline" className="text-xs">{scope}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(apiKey.createdAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(apiKey.lastUsed)}</TableCell>
                      <TableCell>
                        <Badge variant={apiKey.status === "aktiv" ? "default" : "secondary"}>
                          {apiKey.status === "aktiv" ? "Aktiv" : "Widerrufen"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {apiKey.status === "aktiv" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => toast.warning("API-Schlüssel widerrufen", { description: apiKey.label })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Code className="h-5 w-5 text-muted-foreground" />
                API-Endpunkte
              </CardTitle>
              <CardDescription>REST API v1 — Basis-URL: https://api.inari.app/v1</CardDescription>
            </CardHeader>
            <CardContent>
              <Table data-testid="api-endpoints-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Methode</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {API_ENDPOINTS.map((ep) => (
                    <>
                      <TableRow
                        key={ep.id}
                        className="cursor-pointer"
                        onClick={() => setExpandedEndpoint(expandedEndpoint === ep.id ? null : ep.id)}
                      >
                        <TableCell>
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${METHOD_STYLES[ep.method] ?? ""}`}>
                            {ep.method}
                          </span>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm">{ep.route}</code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ep.description}</TableCell>
                        <TableCell>
                          {expandedEndpoint === ep.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedEndpoint === ep.id && (
                        <TableRow key={`${ep.id}_response`}>
                          <TableCell colSpan={4} className="bg-muted/30 p-0">
                            <div className="p-4">
                              <p className="mb-2 text-xs font-medium text-muted-foreground">Beispiel-Antwort</p>
                              <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
                                {JSON.stringify(ep.sampleResponse, null, 2)}
                              </pre>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Integrationen ── */}
        <TabsContent value="integrationen" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {INTEGRATION_TOGGLES.map((toggle) => (
              <Card key={toggle.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{toggle.label}</CardTitle>
                    <CardDescription>{toggle.description}</CardDescription>
                  </div>
                  <Switch
                    checked={integrationStates[toggle.id]}
                    onCheckedChange={(v) => handleToggleIntegration(toggle.id, v)}
                  />
                </CardHeader>
                <CardContent>
                  <Badge variant={integrationStates[toggle.id] ? "default" : "secondary"}>
                    {integrationStates[toggle.id] ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Webhook className="h-5 w-5 text-muted-foreground" />
                  Webhooks
                </CardTitle>
                <CardDescription>Erhalten Sie Echtzeit-Benachrichtigungen über Ereignisse in Ihrem System</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => toast.success("Webhook erstellt", { description: "Konfigurieren Sie die URL und Ereignisse." })}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Neuer Webhook
              </Button>
            </CardHeader>
            <CardContent>
              <Table data-testid="webhook-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Ereignisse</TableHead>
                    <TableHead>Letzter Aufruf</TableHead>
                    <TableHead>Fehler</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {WEBHOOK_CONFIGS.map((wh) => (
                    <TableRow key={wh.id}>
                      <TableCell>
                        {webhookStates[wh.id] && wh.failCount < 3 ? (
                          <CircleCheck className="h-4 w-4 text-emerald-500" />
                        ) : wh.failCount >= 3 ? (
                          <CircleAlert className="h-4 w-4 text-destructive" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{wh.url}</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map((ev) => (
                            <Badge key={ev} variant="outline" className="text-xs">{ev}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {wh.lastTriggered ? formatDate(wh.lastTriggered) : "–"}
                      </TableCell>
                      <TableCell>
                        <span className={wh.failCount > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
                          {wh.failCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={webhookStates[wh.id]}
                          onCheckedChange={(v) => handleToggleWebhook(wh.id, v)}
                        />
                      </TableCell>
                      <TableCell>
                        {wh.failCount > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toast.info("Webhook wird erneut gesendet…", { description: wh.url })}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Verlauf ── */}
        <TabsContent value="verlauf" className="space-y-4">
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
            <p className="self-center text-sm text-muted-foreground">
              {filteredHistory.length} Einträge
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Typ</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Bereich</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erstellt am</TableHead>
                    <TableHead>Größe</TableHead>
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
                          <Badge variant={meta?.variant ?? "secondary"} className="gap-1">
                            {job.status === "in Bearbeitung" && <Loader2 className="h-3 w-3 animate-spin" />}
                            {meta?.label ?? job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(job.createdAt)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{job.fileSize ?? "–"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{job.createdBy}</TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Keine Einträge gefunden.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
