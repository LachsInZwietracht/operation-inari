import { Database, Globe, Scale, TestTube2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchDataSources } from "@/lib/data/data-sources"
import { formatDate, formatNumber } from "@/lib/format"

export default async function DatenbankPage() {
  const { sources, error } = await fetchDataSources()

  const totalRecords = sources.reduce((sum, source) => sum + (source.recordCount ?? 0), 0)
  const latestImport = sources[0]?.importedAt ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datenbankstatus"
        description="Live geladener Quellenkatalog aus Supabase statt statischer Release-Notizen"
        helpText="Diese Ansicht zeigt reale Datensaetze aus der Tabelle `data_sources`: Version, Importzeitpunkt, Datentiefe und Lizenz. Ein redaktioneller Changelog fuer Datenbankupdates existiert derzeit noch nicht."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Aktive Quellen</p>
              <p className="text-2xl font-semibold">{sources.length}</p>
              <p className="text-xs text-muted-foreground">Aus `data_sources` geladen</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <Database className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Erfasste Datensaetze</p>
              <p className="text-2xl font-semibold">{formatNumber(totalRecords)}</p>
              <p className="text-xs text-muted-foreground">Summe der gemeldeten Record Counts</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <TestTube2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Letzter Import</p>
              <p className="text-2xl font-semibold">{latestImport ? formatDate(latestImport) : "–"}</p>
              <p className="text-xs text-muted-foreground">Neuester Zeitstempel aus dem Quellenkatalog</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Quellenkatalog derzeit nicht verfuegbar</CardTitle>
            <CardDescription>
              Die Seite faellt bewusst nicht auf statische Release-Notizen zurueck, wenn Supabase-Daten fehlen.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Katalogstatus</CardTitle>
            <Badge>Live</Badge>
          </div>
          <CardDescription>Versionen, Importzeitpunkte, Datentiefe und Lizenzen pro Quelle.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <div key={source.id} className="rounded-lg border p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{source.name}</p>
                  <p className="text-xs text-muted-foreground">Quelle: {source.id}</p>
                </div>
                <Badge variant="outline">v{source.version}</Badge>
              </div>
              <div className="mt-4 space-y-2 text-muted-foreground">
                <p>Importiert: {formatDate(source.importedAt)}</p>
                <p>Datensaetze: {source.recordCount != null ? formatNumber(source.recordCount) : "nicht hinterlegt"}</p>
                <p>Naehrstoffe: {source.nutrientCount != null ? formatNumber(source.nutrientCount) : "nicht hinterlegt"}</p>
                <p>Lizenz: {source.license ?? "nicht hinterlegt"}</p>
                {source.url ? (
                  <a className="text-primary underline-offset-4 hover:underline" href={source.url} rel="noreferrer" target="_blank">
                    Quelle oeffnen
                  </a>
                ) : null}
              </div>
            </div>
          ))}
          {sources.length === 0 && !error ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Keine Datenquellen gefunden. Fuehren Sie die Seed-/Migrationsschritte fuer `data_sources` aus.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-muted-foreground" />
              Hinweis zur Aenderungshistorie
            </CardTitle>
            <Badge variant="secondary">Informational</Badge>
          </div>
          <CardDescription>Es gibt derzeit keinen separaten redaktionellen Release-Feed fuer Datenbankupdates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Diese Seite zeigt den produktiven Quellenkatalog. Wenn kuenftig echte Import-Changelogs benoetigt werden,
            sollten sie in einer eigenen Tabelle oder einem CMS gepflegt werden statt ueber statische Mock-Notizen.
          </p>
          <p>
            Bis dahin gelten Version, Importzeitpunkt, Record Count und Lizenzangaben als massgebliche Live-Metadaten.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
