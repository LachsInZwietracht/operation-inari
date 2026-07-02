"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Code,
  Clock,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Key,
  ShieldCheck,
  Trash2,
  Upload,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { API_ENDPOINT_PREVIEWS } from "@/lib/content/ops-preview"
import { SUPPORTED_EXPORTS } from "@/lib/exports/constants"
import { formatDate } from "@/lib/format"
import type {
  ApiKeyRecord,
  ExportFormat,
  ExportJobRecord,
  ExportScope,
} from "@/lib/types"
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

function formatHistoryError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error)
  if (raw.includes("export_jobs")) {
    return "Das Export-Journal ist nicht konfiguriert. Pruefen Sie, ob die `export_jobs` Migration in dieser Supabase-Umgebung angewendet wurde."
  }
  if (raw.includes("Failed to fetch") || raw.includes("NetworkError")) {
    return "Das Export-Journal konnte nicht erreicht werden. Pruefen Sie die lokale Supabase-/API-Verbindung und laden Sie die Seite neu."
  }
  return raw || "Export-Historie konnte nicht geladen werden."
}

function formatApiKeyError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error)
  if (raw.includes("api_keys")) {
    return "API-Schluessel sind in dieser Supabase-Umgebung noch nicht konfiguriert. Wenden Sie die `api_keys` Migration an."
  }
  if (raw.includes("FORBIDDEN")) {
    return "Nur Owner und Administrator:innen koennen API-Schluessel verwalten."
  }
  if (raw.includes("Failed to fetch") || raw.includes("NetworkError")) {
    return "API-Schluessel konnten nicht geladen werden. Pruefen Sie die lokale Supabase-/API-Verbindung."
  }
  return raw || "API-Schluessel konnten nicht geladen werden."
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
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [newApiKeyName, setNewApiKeyName] = useState("Klinik Export")
  const [newApiKeyExpiresAt, setNewApiKeyExpiresAt] = useState("")
  const [createdApiKeyToken, setCreatedApiKeyToken] = useState<string | null>(null)
  const [isCreatingApiKey, setIsCreatingApiKey] = useState(false)
  const [revokingApiKeyId, setRevokingApiKeyId] = useState<string | null>(null)
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
      const message = formatHistoryError(error)
      setHistoryError(message)
      toast.error(message)
    }
  }

  async function loadApiKeys() {
    try {
      const response = await fetch("/api/api-keys", { cache: "no-store" })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      setApiKeys((await response.json()) as ApiKeyRecord[])
      setApiKeyError(null)
    } catch (error) {
      const message = formatApiKeyError(error)
      setApiKeyError(message)
      toast.error(message)
    }
  }

  useEffect(() => {
    void loadExportJobs()
    void loadApiKeys()
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

  async function handleCreateApiKey() {
    setIsCreatingApiKey(true)
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newApiKeyName,
          scopes: ["exports:datasets:read"],
          expiresAt: newApiKeyExpiresAt || null,
        }),
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const data = (await response.json()) as { apiKey: ApiKeyRecord; token: string }
      setCreatedApiKeyToken(data.token)
      setApiKeys((current) => [data.apiKey, ...current])
      setNewApiKeyName("Klinik Export")
      setNewApiKeyExpiresAt("")
      setApiKeyError(null)
      toast.success("API-Schluessel erstellt", {
        description: "Der Token wird nur jetzt vollstaendig angezeigt.",
      })
    } catch (error) {
      const message = formatApiKeyError(error)
      setApiKeyError(message)
      toast.error(message)
    } finally {
      setIsCreatingApiKey(false)
    }
  }

  async function handleRevokeApiKey(keyId: string) {
    setRevokingApiKeyId(keyId)
    try {
      const response = await fetch(`/api/api-keys/${keyId}/revoke`, { method: "POST" })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const revokedKey = (await response.json()) as ApiKeyRecord
      setApiKeys((current) => current.map((apiKey) => (apiKey.id === keyId ? revokedKey : apiKey)))
      toast.success("API-Schluessel widerrufen")
    } catch (error) {
      toast.error(formatApiKeyError(error))
    } finally {
      setRevokingApiKeyId(null)
    }
  }

  async function handleCopyToken() {
    if (!createdApiKeyToken) return
    await navigator.clipboard.writeText(createdApiKeyToken)
    toast.success("Token kopiert")
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
        helpText="Die Exporterstellung und das Exportjournal laufen produktiv ueber Supabase. Externe REST-API und API-Schluessel sind in dieser Ansicht bewusst als Preview gekennzeichnet."
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
                <br />
                Naechster Schritt: Migrationen anwenden oder `/api/export-jobs` in der lokalen Umgebung pruefen.
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
                  REST API Schluessel
                </CardTitle>
                <Badge variant="default">Live</Badge>
              </div>
              <CardDescription>
                Owner und Administrator:innen koennen Tokens fuer den ersten produktiven REST-Endpunkt ausstellen,
                ueberwachen und widerrufen.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold">Live verwaltete API-Schluessel</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Token-Erstellung, letzte Nutzung, Ablaufdatum und Widerruf laufen ueber Supabase.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold">Begrenzter Export-Scope</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  `exports:datasets:read` erlaubt aktuell nur Lebensmittel-Datasets ohne benutzereigene Sonderdaten.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold">Auditpflichtig</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Erstellung, Widerruf und API-Exporte landen im Zugriffsjournal der Organisation.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                Schluesselverwaltung
              </CardTitle>
              <CardDescription>Der vollstaendige Token wird nur direkt nach der Erstellung angezeigt.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKeyError && (
                <Alert variant="destructive">
                  <AlertTitle>API-Schluessel nicht verfügbar</AlertTitle>
                  <AlertDescription>{apiKeyError}</AlertDescription>
                </Alert>
              )}

              {createdApiKeyToken && (
                <Alert>
                  <Key className="h-4 w-4" />
                  <AlertTitle>Neuer Token</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code data-testid="created-api-key-token" className="break-all rounded bg-muted px-2 py-1 text-xs">
                        {createdApiKeyToken}
                      </code>
                      <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyToken()}>
                        <Copy className="mr-2 h-4 w-4" />
                        Kopieren
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="api-key-name">Name</Label>
                  <Input
                    id="api-key-name"
                    value={newApiKeyName}
                    onChange={(event) => setNewApiKeyName(event.target.value)}
                    placeholder="KIS Export"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-key-expires">Ablaufdatum</Label>
                  <Input
                    id="api-key-expires"
                    type="date"
                    value={newApiKeyExpiresAt}
                    onChange={(event) => setNewApiKeyExpiresAt(event.target.value)}
                  />
                </div>
                <Button type="button" onClick={() => void handleCreateApiKey()} disabled={isCreatingApiKey || !newApiKeyName.trim()}>
                  <Key className="mr-2 h-4 w-4" />
                  {isCreatingApiKey ? "Erstellt..." : "Schluessel erstellen"}
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table data-testid="api-keys-table" className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Scopes</TableHead>
                      <TableHead>Ablauf</TableHead>
                      <TableHead>Letzte Nutzung</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-sm text-muted-foreground">
                          Noch keine API-Schluessel erstellt.
                        </TableCell>
                      </TableRow>
                    ) : (
                      apiKeys.map((apiKey) => {
                        const isRevoked = Boolean(apiKey.revokedAt)
                        return (
                          <TableRow key={apiKey.id}>
                            <TableCell className="font-medium">{apiKey.name}</TableCell>
                            <TableCell>
                              <code className="text-xs">{apiKey.tokenPrefix}...</code>
                            </TableCell>
                            <TableCell className="text-xs">{apiKey.scopes.join(", ")}</TableCell>
                            <TableCell>{apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "Kein Ablauf"}</TableCell>
                            <TableCell>{apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "Noch nicht genutzt"}</TableCell>
                            <TableCell>
                              <Badge variant={isRevoked ? "secondary" : "default"}>
                                {isRevoked ? "Widerrufen" : "Aktiv"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void handleRevokeApiKey(apiKey.id)}
                                disabled={isRevoked || revokingApiKeyId === apiKey.id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {revokingApiKeyId === apiKey.id ? "Widerruft..." : "Widerrufen"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Code className="h-5 w-5 text-muted-foreground" />
                Endpunkte
              </CardTitle>
              <CardDescription>
                `/api/exports/datasets` akzeptiert `Authorization: Bearer prodi_...` fuer Lebensmittel-Exporte.
                Weitere Endpunkte bleiben als Integrationsvorschau dokumentiert.
              </CardDescription>
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

        <TabsContent value="verlauf" className="space-y-4">
          {historyError && (
            <Alert variant="destructive">
              <AlertTitle>Export-Journal konnte nicht geladen werden</AlertTitle>
              <AlertDescription>
                {historyError}
                <br />
                Naechster Schritt: Migrationen anwenden oder `/api/export-jobs` in der lokalen Umgebung pruefen.
              </AlertDescription>
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
