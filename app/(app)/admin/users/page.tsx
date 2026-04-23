"use client"

import { DatabaseBackup, LockKeyhole, Shield, ShieldCheck, Users as UsersIcon } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import {
  ADMIN_COMPLIANCE_CHECKLIST,
  ADMIN_ENCRYPTION_LAYERS,
  ADMIN_RECOVERY_OBJECTIVES,
  ADMIN_ROLE_MATRIX,
  ADMIN_SECURITY_CONTROLS,
} from "@/lib/content/ops-preview"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const ACCESS_COLORS: Record<string, string> = {
  vollzugriff: "bg-emerald-500/15 text-emerald-500",
  bearbeiten: "bg-blue-500/15 text-blue-500",
  einsicht: "bg-slate-500/15 text-slate-500",
  gesperrt: "bg-destructive/20 text-destructive",
}

const CONTROL_IMPACT_BADGE: Record<"hoch" | "mittel" | "niedrig", string> = {
  hoch: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  mittel: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  niedrig: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
}

const RECOVERY_STATUS_COLORS: Record<string, string> = {
  grün: "text-emerald-600",
  gelb: "text-amber-500",
  rot: "text-red-600",
}

export default function AdminUsersPage() {
  const { user, isAuthenticated, loading } = useAuth()

  const sessionRole = typeof user?.user_metadata?.role === "string" ? user.user_metadata.role : "nicht konfiguriert"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin & Sicherheit"
        description="Read-only Vorschau fuer Rollenmodell, Controls und Wiederherstellungsziele"
        helpText="Diese Seite zeigt aktuell das geplante Betriebsmodell. Teamverwaltung, Einladungen, Audit-Log und Richtliniensteuerung sind noch nicht an einen produktiven Admin-Backend-Workflow angebunden."
      />

      <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20">
        <CardContent className="flex flex-col gap-2 pt-6 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Preview</Badge>
            <span className="font-medium">Kein produktives RBAC-/Teammanagement-Backend</span>
          </div>
          <p className="text-muted-foreground">
            Rollenwechsel, Einladungen, MFA-Resets, Audit-Trails und Security-Toggles werden hier bewusst nicht als
            live steuerbar dargestellt, solange dafuer noch keine persistierten Tabellen und Freigabeflows existieren.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Aktuelle Session</p>
              <p className="text-lg font-semibold">{loading ? "Pruefe..." : isAuthenticated ? "Angemeldet" : "Keine Session"}</p>
              <p className="text-xs text-muted-foreground">{user?.email ?? "Supabase Auth liefert derzeit keinen aktiven Benutzer."}</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <UsersIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Session-Rolle</p>
              <p className="text-lg font-semibold capitalize">{sessionRole}</p>
              <p className="text-xs text-muted-foreground">Abgeleitet aus Supabase User-Metadaten, falls vorhanden.</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Rollenprofile</p>
              <p className="text-lg font-semibold">{ADMIN_ROLE_MATRIX.length}</p>
              <p className="text-xs text-muted-foreground">Bundled Rollenmodell fuer das geplante Admin-Backend.</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Kontrollkatalog</p>
              <p className="text-lg font-semibold">{ADMIN_SECURITY_CONTROLS.length}</p>
              <p className="text-xs text-muted-foreground">Read-only Zielbild, keine produktive Policy-Steuerung.</p>
            </div>
            <div className="rounded-full bg-muted p-2">
              <LockKeyhole className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-muted-foreground" />
                Rollenmatrix & Berechtigungen
              </CardTitle>
              <CardDescription>Bundled Rollenmodell als Referenz fuer das spaetere Admin-Backend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ADMIN_ROLE_MATRIX.map((role) => (
                <div key={role.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div>
                      <p className="font-semibold">{role.label}</p>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {role.permissions.filter((permission) => permission.access === "vollzugriff").length} volle Bereiche
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {role.permissions.map((permission) => (
                      <div key={permission.module} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        <span className="font-medium">
                          {permission.module}
                          {permission.critical ? (
                            <Badge className="ml-2 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">kritisch</Badge>
                          ) : null}
                        </span>
                        <Badge className={cn("text-xs capitalize", ACCESS_COLORS[permission.access])}>{permission.access}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LockKeyhole className="h-5 w-5 text-muted-foreground" />
                Sicherheitskontrollen
              </CardTitle>
              <CardDescription>Geplante Controls; derzeit nicht live ueber diese Seite schaltbar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ADMIN_SECURITY_CONTROLS.map((control) => (
                <div key={control.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{control.label}</p>
                      <p className="text-xs text-muted-foreground">{control.description}</p>
                    </div>
                    <Badge className={cn("text-xs capitalize", CONTROL_IMPACT_BADGE[control.impact])}>{control.impact}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Zielstatus</span>
                    <Badge variant={control.enabled ? "default" : "secondary"}>{control.enabled ? "Vorgesehen aktiv" : "Noch offen"}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                Verschluesselung & Compliance
              </CardTitle>
              <CardDescription>Transparenz ueber aktuelle Plattformbasis und offene Betriebsaufgaben.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Verschluesselungsebenen</p>
                {ADMIN_ENCRYPTION_LAYERS.map((layer) => (
                  <div key={layer.id} className="rounded-lg border bg-muted/40 px-3 py-2">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{layer.layer}</span>
                      <Badge
                        className={cn(
                          "text-[11px] capitalize",
                          layer.status === "aktiv" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
                          layer.status === "wartung" && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
                          layer.status === "risiko" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
                        )}
                      >
                        {layer.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{layer.detail}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Compliance-Checkliste</p>
                {ADMIN_COMPLIANCE_CHECKLIST.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">Owner: {item.owner}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        item.status === "erfüllt" && "border-emerald-200 text-emerald-700",
                        item.status === "in arbeit" && "border-amber-200 text-amber-700",
                        item.status === "offen" && "border-destructive text-destructive",
                      )}
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DatabaseBackup className="h-5 w-5 text-muted-foreground" />
                Backups & Recovery-Ziele
              </CardTitle>
              <CardDescription>Read-only Zielwerte; kein Live-Monitoring aus der Produktivumgebung.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ADMIN_RECOVERY_OBJECTIVES.map((objective) => (
                <div key={objective.id} className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span>{objective.metric}</span>
                  <span className={cn("font-semibold", RECOVERY_STATUS_COLORS[objective.status])}>{objective.value}</span>
                  <span className="text-xs text-muted-foreground">Ziel: {objective.target}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
