"use client"

import { Activity, Gauge, SearchCheck, ShieldCheck, TerminalSquare } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  HOTSPOT_NOTES,
  MANUAL_VERIFICATION_CHECKS,
  REFERENCE_BENCHMARKS,
  VALIDATION_WORKFLOWS,
} from "@/lib/content/validation-reference"

export default function LeistungPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leistung & Validierung"
        description="Referenzseite fuer Checks, Benchmark-Ziele und manuelle Verifikation"
        helpText="Diese Seite ist bewusst keine Live-Telemetrie. Sie dokumentiert die verfuegbaren Validierungswege im Repo und die Zielwerte, an denen echte Performance- und Betriebsarbeit gemessen werden sollte."
      />

      <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20">
        <CardContent className="flex flex-col gap-2 pt-6 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Referenz</Badge>
            <span className="font-medium">Keine Live-Metriken aus Produktions- oder Preview-Telemetrie</span>
          </div>
          <p className="text-muted-foreground">
            Stress-Tests, Antwortzeitkurven, Systemressourcen und DB-Abfragen werden in dieser Ansicht nicht mehr als
            Echtzeitdaten simuliert. Stattdessen werden die vorhandenen Verifikationswege und Zielwerte transparent
            dokumentiert.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Automatisierte Checks</p>
              <p className="text-2xl font-semibold">{VALIDATION_WORKFLOWS.length}</p>
              <p className="text-xs text-muted-foreground">Typecheck, Playwright und Naehrstoffvalidierung</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Benchmark-Ziele</p>
              <p className="text-2xl font-semibold">{REFERENCE_BENCHMARKS.length}</p>
              <p className="text-xs text-muted-foreground">Kompakte Referenzwerte fuer Kernpfade</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <Gauge className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Hotspots</p>
              <p className="text-2xl font-semibold">{HOTSPOT_NOTES.length}</p>
              <p className="text-xs text-muted-foreground">Bereiche mit hohem Risiko fuer Regressionskosten</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Manuelle Pruefpunkte</p>
              <p className="text-2xl font-semibold">{MANUAL_VERIFICATION_CHECKS.length}</p>
              <p className="text-xs text-muted-foreground">Ops-Seiten mit Pflicht-Smoketests nach Aenderungen</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <SearchCheck className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TerminalSquare className="h-5 w-5 text-muted-foreground" />
                Automatisierte Validierung
              </CardTitle>
              <CardDescription>Repo-Checks, die tatsaechlich heute zur Verifikation verfuegbar sind.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {VALIDATION_WORKFLOWS.map((workflow) => (
                <div key={workflow.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{workflow.label}</p>
                      <p className="text-sm text-muted-foreground">{workflow.description}</p>
                    </div>
                    <Badge>Verfuegbar</Badge>
                  </div>
                  <code className="mt-3 block rounded bg-muted px-3 py-2 text-xs">{workflow.command}</code>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hotspots fuer Regressionen</CardTitle>
              <CardDescription>Diese Bereiche verdienen gezielte Checks nach Performance- oder Ops-Aenderungen.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {HOTSPOT_NOTES.map((hotspot) => (
                <div key={hotspot.id} className="rounded-lg border p-4">
                  <p className="font-semibold">{hotspot.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{hotspot.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Benchmark-Ziele</CardTitle>
              <CardDescription>Referenzwerte, keine live gemessenen Dashboard-Metriken.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {REFERENCE_BENCHMARKS.map((benchmark) => (
                <div key={benchmark.id} className="rounded-lg border p-4">
                  <p className="text-xs uppercase text-muted-foreground">{benchmark.label}</p>
                  <p className="text-2xl font-semibold">{benchmark.value}</p>
                  <p className="text-xs text-muted-foreground">{benchmark.helper}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manuelle Verifikation</CardTitle>
              <CardDescription>Routen, die nach Ops-Oberflaechen-Aenderungen bewusst im Browser geprueft werden sollten.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {MANUAL_VERIFICATION_CHECKS.map((check) => (
                <div key={check.id} className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium">{check.route}</p>
                  <p className="text-muted-foreground">{check.focus}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
