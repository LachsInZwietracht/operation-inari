import Link from "next/link"
import { ArrowRightLeft, Check, Clock3, Database, FileClock, GitCompareArrows, Globe, Lock, PlugZap, Scale, TestTube2, Upload } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchDataSources } from "@/lib/data/data-sources"
import { fetchDataSourceEvents, fetchFoodReferenceReplacements } from "@/lib/data/database-lifecycle"
import { canAccessDataSource } from "@/lib/data/entitlements"
import { FOOD_SOURCES } from "@/lib/data/food-sources"
import { formatDate, formatNumber } from "@/lib/format"
import type { FoodSourceId } from "@/lib/types"

// Sources the foods browser can scope to — mirrors ACTIVE_FOOD_BROWSER_SOURCE_IDS
// in the foods browser so the governance view and the working selector agree.
const CONNECTABLE_SOURCE_IDS: FoodSourceId[] = ["bls", "sfk", "off", "custom"]
import { BulkReplacementForm } from "./bulk-replacement-form"
import { FoodReplacementForm } from "./food-replacement-form"
import { NutrientDiffCard } from "./nutrient-diff-card"

function DatabaseLoadError({ title, error, tableName }: { title: string; error: string; tableName: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">{title}</p>
      <p className="mt-1 text-muted-foreground">{error}</p>
      <p className="mt-2 text-muted-foreground">
        Naechster Schritt: Pruefen, ob die Migration fuer `{tableName}` in dieser Supabase-Umgebung angewendet wurde.
      </p>
    </div>
  )
}

export default async function DatenbankPage() {
  const [
    { sources, error },
    { events, error: eventsError },
    { replacements, error: replacementsError },
  ] = await Promise.all([
    fetchDataSources(),
    fetchDataSourceEvents(),
    fetchFoodReferenceReplacements(),
  ])

  const totalRecords = sources.reduce((sum, source) => sum + (source.recordCount ?? 0), 0)
  const latestImport = sources[0]?.importedAt ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datenbankstatus"
        description="Quellen, Versionen, Aenderungshistorie und auditierte Lebensmittelreferenzen"
        helpText="Diese Ansicht zeigt reale Datenbank-Metadaten aus Supabase. Versionen kommen aus `data_sources`, Import-/Mappingereignisse aus `data_source_events`, und Lebensmittelersetzungen werden als Auditvorgang protokolliert."
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <PlugZap className="h-5 w-5 text-muted-foreground" />
              Verbundene Datenbanken
            </CardTitle>
          </div>
          <CardDescription>
            Diese Quellen stehen in der Lebensmittelsuche zur Auswahl. Die aktive Datenbank wählen
            Sie direkt in der Lebensmittel-Suche; gesperrte Quellen werden über den Tarif
            freigeschaltet.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CONNECTABLE_SOURCE_IDS.map((id) => {
            const meta = FOOD_SOURCES.find((source) => source.id === id)
            if (!meta) return null
            const active = canAccessDataSource(id)
            return (
              <div key={id} className="rounded-lg border p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{meta.name}</p>
                    <p className="text-xs text-muted-foreground">{meta.coverage}</p>
                  </div>
                  {active ? (
                    <Badge className="shrink-0 gap-1">
                      <Check className="h-3 w-3" />
                      Aktiv
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 gap-1">
                      <Lock className="h-3 w-3" />
                      Tarif
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-muted-foreground">{meta.description}</p>
                {!active && (
                  <Link
                    href="/admin/tarife"
                    className="mt-3 inline-block text-primary underline-offset-4 hover:underline"
                  >
                    Im Tarif freischalten
                  </Link>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

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
              <FileClock className="h-5 w-5 text-muted-foreground" />
              Datenbankhistorie
            </CardTitle>
            <Badge variant="secondary">Audit</Badge>
          </div>
          <CardDescription>Importe, Versionswechsel, Mappingkorrekturen und lizenzrelevante Hinweise pro Quelle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {eventsError ? (
            <DatabaseLoadError
              title="Datenbankhistorie nicht verfuegbar"
              error={eventsError}
              tableName="data_source_events"
            />
          ) : null}
          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="rounded-lg border p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{event.title}</p>
                        <Badge variant="outline">{event.eventType}</Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{event.summary}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{event.dataSourceId.toUpperCase()} {event.version ? `v${event.version}` : ""}</p>
                      <p>{formatDate(event.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Datensaetze: {event.recordCount != null ? formatNumber(event.recordCount) : "k.A."}</span>
                    <span>Naehrstoffe: {event.nutrientCount != null ? formatNumber(event.nutrientCount) : "k.A."}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : !eventsError ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Noch keine Datenbankereignisse protokolliert. Kuenftige ETL- und Mappinglaeufe schreiben hier echte
              Changelog-Zeilen statt statischer Release-Notizen.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5 text-muted-foreground" />
              Naehrstoffvergleich
            </CardTitle>
            <Badge variant="secondary">Diff</Badge>
          </div>
          <CardDescription>
            Zwei Lebensmittel (auch quellenuebergreifend) vergleichen. Abweichungen ueber 10% werden farblich hervorgehoben.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NutrientDiffCard />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              Lebensmittelreferenzen ersetzen
            </CardTitle>
            <Badge variant="secondary">Admin</Badge>
          </div>
          <CardDescription>
            Ersetzt ein Lebensmittel in eigenen Rezepten, Tagesplaenen und Ernaehrungsprotokollen und schreibt ein
            Auditprotokoll. System- und Fremddaten bleiben in v1 unveraendert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FoodReplacementForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              Massen-Ersetzung
            </CardTitle>
            <Badge variant="secondary">CSV</Badge>
          </div>
          <CardDescription>
            Mehrere Lebensmittelreferenzen auf einmal per CSV-Datei ersetzen. Format: source_bls_code;target_bls_code;reason.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BulkReplacementForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-muted-foreground" />
              Ersetzungsprotokoll
            </CardTitle>
            <Badge variant="outline">Live</Badge>
          </div>
          <CardDescription>Letzte Lebensmittelersetzungen im eigenen Mandanten-/Benutzerkontext.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {replacementsError ? (
            <DatabaseLoadError
              title="Ersetzungsprotokoll nicht verfuegbar"
              error={replacementsError}
              tableName="food_reference_replacements"
            />
          ) : null}
          {replacements.map((replacement) => {
            const total =
              replacement.recipeIngredientsUpdated +
              replacement.mealEntriesUpdated +
              replacement.protocolEntriesUpdated

            return (
              <div key={replacement.id} className="rounded-lg border p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {replacement.sourceFoodName ?? replacement.sourceFoodId} -&gt;{" "}
                      {replacement.targetFoodName ?? replacement.targetFoodId}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {total} Referenzen: {replacement.recipeIngredientsUpdated} Rezeptzutaten,{" "}
                      {replacement.mealEntriesUpdated} Planeintraege, {replacement.protocolEntriesUpdated} Protokolleintraege
                    </p>
                    {replacement.reason ? (
                      <p className="mt-1 text-muted-foreground">Begruendung: {replacement.reason}</p>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(replacement.createdAt)}</p>
                </div>
              </div>
            )
          })}
          {replacements.length === 0 && !replacementsError ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Noch keine Lebensmittelreferenzen ersetzt.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-muted-foreground" />
              Scope v1
            </CardTitle>
            <Badge variant="secondary">Traceability</Badge>
          </div>
          <CardDescription>Grenzen der ersten Datenbank-Lifecycle-Ausbaustufe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Die Ersetzung laeuft atomar in Supabase und betrifft eigene Rezepte, Tagesplaene und Protokolle. Sie ist
            fuer Datenbankupdates, Dubletten und veraltete Referenzen gedacht.
          </p>
          <p>
            Kuenftige Ausbaustufen koennen globale Systemrezepte, institutionelle Freigabeprozesse, Diff-Uploads und
            ETL-seitige `data_source_events` direkt an Importjobs koppeln.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
