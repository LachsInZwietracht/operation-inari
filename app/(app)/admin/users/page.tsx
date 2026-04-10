"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  DatabaseBackup,
  History,
  KeyRound,
  LockKeyhole,
  Shield,
  ShieldCheck,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ADMIN_USERS,
  ROLE_MATRIX,
  AUDIT_LOG,
  BACKUP_STATUS,
  SECURITY_CONTROLS,
  ENCRYPTION_LAYERS,
  COMPLIANCE_CHECKLIST,
  SESSION_METRICS,
  RECOVERY_OBJECTIVES,
} from "@/lib/mock-data"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const USER_STATUS_STYLES: Record<string, string> = {
  aktiv: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  gesperrt: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  eingeladen: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
}

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
  const [users, setUsers] = useState(ADMIN_USERS)
  const [controlStates, setControlStates] = useState<Record<string, boolean>>(
    () => Object.fromEntries(SECURITY_CONTROLS.map((control) => [control.id, control.enabled])),
  )
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    role: ROLE_MATRIX[1]?.id ?? "ernaehrungsberater",
    sendWelcome: true,
  })
  const [auditFilter, setAuditFilter] = useState("all")

  const stats = useMemo(() => {
    const active = users.filter((u) => u.status === "aktiv").length
    const invited = users.filter((u) => u.status === "eingeladen").length
    const locked = users.filter((u) => u.status === "gesperrt").length

    return [
      {
        label: "Aktive Nutzer:innen",
        value: active,
        helper: `${locked} gesperrt`,
        icon: UsersIcon,
      },
      {
        label: "Ausstehende Einladungen",
        value: invited,
        helper: "Schnell aktivieren oder erneut senden",
        icon: UserPlus,
      },
      {
        label: "Rollenprofile",
        value: ROLE_MATRIX.length,
        helper: "RBAC im Einsatz",
        icon: ShieldCheck,
      },
      {
        label: "Audit-Events (24h)",
        value: AUDIT_LOG.length,
        helper: `Letzter Eintrag ${formatDate(AUDIT_LOG[0].timestamp)}`,
        icon: History,
      },
    ]
  }, [users])

  const uniqueActors = useMemo(() => Array.from(new Set(AUDIT_LOG.map((entry) => entry.actor))), [])

  const filteredAudit = AUDIT_LOG.filter((entry) => auditFilter === "all" || entry.actor === auditFilter)

  function updateUser(id: string, patch: Partial<(typeof users)[number]>) {
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, ...patch } : user)))
  }

  function handleRoleChange(id: string, role: string) {
    updateUser(id, { role })
    toast.success("Rolle aktualisiert", { description: `Nutzer hat jetzt die Rolle ${role}.` })
  }

  function handleStatusChange(id: string, status: string) {
    updateUser(id, { status: status as (typeof users)[number]["status"] })
    toast.message("Nutzerstatus gespeichert", { description: `Status wurde auf ${status} gesetzt.` })
  }

  function handleResetMfa(name: string) {
    toast.info("Zwei-Faktor zurückgesetzt", {
      description: `${name} muss sich beim nächsten Login erneut verifizieren.`,
    })
  }

  function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inviteForm.email || !inviteForm.name) {
      toast.error("Bitte Name und E-Mail ausfüllen")
      return
    }

    toast.success("Einladung versendet", {
      description: `${inviteForm.name} erhält eine Einladung als ${inviteForm.role}.`,
    })
    setInviteForm((prev) => ({ ...prev, name: "", email: "" }))
  }

  function handleToggleControl(id: string, enabled: boolean) {
    setControlStates((prev) => ({ ...prev, [id]: enabled }))
    toast.success(enabled ? "Kontrolle aktiviert" : "Kontrolle deaktiviert")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin & Sicherheit"
        description="Nutzer verwalten, Rollen absichern und Compliance-Vorgaben erfüllen"
        helpText="Verwalten Sie Benutzerkonten, Rollen und Berechtigungen. Überwachen Sie Sicherheitsereignisse und stellen Sie die Einhaltung von Datenschutz- und Compliance-Vorgaben sicher."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="flex items-center justify-between gap-4 pt-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                <p className="text-2xl font-semibold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.helper}</p>
              </div>
              <div className="rounded-full bg-muted p-2">
                <metric.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UsersIcon className="h-5 w-5 text-muted-foreground" />
                Team & Rollen
              </CardTitle>
              <CardDescription>Aktivieren Sie neue Benutzer:innen und geben Sie ihnen sichere Rechte</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                RBAC ist live: Nutzerstatus, Rollenwechsel und MFA-Resets greifen sofort und werden im Audit-Log mitgeschrieben.
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nutzer</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                          <div className="text-xs text-muted-foreground">Letzter Login: {user.lastLogin}</div>
                        </TableCell>
                        <TableCell className="w-[180px]">
                          <Select value={user.role} onValueChange={(value) => handleRoleChange(user.id, value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_MATRIX.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="w-[170px]">
                          <div className="flex flex-col gap-2">
                            <Badge className={cn("w-fit text-[11px] font-medium", USER_STATUS_STYLES[user.status])}>
                              {user.status}
                            </Badge>
                            <Select value={user.status} onValueChange={(value) => handleStatusChange(user.id, value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.keys(USER_STATUS_STYLES).map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleResetMfa(user.name)}>
                            <KeyRound className="mr-1.5 h-4 w-4" />
                            MFA zurücksetzen
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-muted-foreground" />
                Rollenmatrix & Berechtigungen
              </CardTitle>
              <CardDescription>Konfigurierte Rollen inklusive kritischer Bereiche</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ROLE_MATRIX.map((role) => (
                <div key={role.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div>
                      <p className="font-semibold">{role.label}</p>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {role.permissions.filter((perm) => perm.access === "vollzugriff").length} volle Bereiche
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {role.permissions.map((permission) => (
                      <div key={permission.module} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        <span className="font-medium">
                          {permission.module}
                          {permission.critical && (
                            <Badge className="ml-2 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">kritisch</Badge>
                          )}
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
                <History className="h-5 w-5 text-muted-foreground" />
                Audit-Log
              </CardTitle>
              <CardDescription>Nachvollziehbare Aktivitäten gemäß DSGVO Art. 30/33</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Label className="text-sm text-muted-foreground">Filter nach Akteur</Label>
                <Select value={auditFilter} onValueChange={setAuditFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    {uniqueActors.map((actor) => (
                      <SelectItem key={actor} value={actor}>
                        {actor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zeitpunkt</TableHead>
                      <TableHead>Aktion</TableHead>
                      <TableHead>Betreff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAudit.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">{formatDate(entry.timestamp)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{entry.actor}</div>
                          <p className="text-xs text-muted-foreground">{entry.action}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.target}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-5 w-5 text-muted-foreground" />
                Benutzer einladen
              </CardTitle>
              <CardDescription>Einladungen enthalten automatisch Links zur MFA-Aktivierung</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleInviteSubmit}>
                <div className="grid gap-3">
                  <Label>Name</Label>
                  <Input
                    placeholder="Max Mustermann"
                    value={inviteForm.name}
                    onChange={(event) => setInviteForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div className="grid gap-3">
                  <Label>E-Mail</Label>
                  <Input
                    type="email"
                    placeholder="team@praxis.de"
                    value={inviteForm.email}
                    onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <div className="grid gap-3">
                  <Label>Rolle</Label>
                  <Select value={inviteForm.role} onValueChange={(value) => setInviteForm((prev) => ({ ...prev, role: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_MATRIX.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Willkommens-E-Mail senden</p>
                    <p className="text-xs text-muted-foreground">Enthält Datenschutz- & MFA-Schritte</p>
                  </div>
                  <Switch
                    checked={inviteForm.sendWelcome}
                    onCheckedChange={(checked) => setInviteForm((prev) => ({ ...prev, sendWelcome: checked }))}
                  />
                </div>
                <Button className="w-full" type="submit">
                  Einladung versenden
                </Button>
              </form>

              <div className="mt-6 grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                {SESSION_METRICS.map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between text-sm">
                    <span>{metric.label}</span>
                    <div className="text-right">
                      <span className="font-semibold">
                        {metric.value}
                        {metric.unit ? <span className="ml-1 text-xs font-medium text-muted-foreground">{metric.unit}</span> : null}
                      </span>
                      <div className={cn("text-xs", metric.change >= 0 ? "text-emerald-600" : "text-red-500")}>{metric.change >= 0 ? `+${metric.change}%` : `${metric.change}%`}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LockKeyhole className="h-5 w-5 text-muted-foreground" />
                Sicherheitskontrollen
              </CardTitle>
              <CardDescription>Kritische Plattformregeln zentral schalten</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {SECURITY_CONTROLS.map((control) => (
                <div key={control.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{control.label}</p>
                      <p className="text-xs text-muted-foreground">{control.description}</p>
                    </div>
                    <Badge className={cn("text-xs capitalize", CONTROL_IMPACT_BADGE[control.impact])}>
                      {control.impact}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {controlStates[control.id] ? "aktiv" : "deaktiviert"}
                    </span>
                    <Switch
                      checked={controlStates[control.id]}
                      onCheckedChange={(checked) => handleToggleControl(control.id, checked)}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                Verschlüsselung & Compliance
              </CardTitle>
              <CardDescription>Transparenz für Auditor:innen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Verschlüsselungsebenen</p>
                {ENCRYPTION_LAYERS.map((layer) => (
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
                {COMPLIANCE_CHECKLIST.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">Owner: {item.owner}{item.dueDate ? ` · fällig ${formatDate(item.dueDate)}` : ""}</p>
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
                Backups & Notfallwiederherstellung
              </CardTitle>
              <CardDescription>Automatisierte Snapshots + wöchentliche Restore-Tests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {BACKUP_STATUS.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{backup.location}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(backup.timestamp)}</p>
                    </div>
                    <Badge
                      className={cn(
                        "text-[11px]",
                        backup.status === "ok" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
                        backup.status === "warning" && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
                        backup.status === "error" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
                      )}
                    >
                      {backup.status}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="text-xs font-semibold text-muted-foreground">Recovery Objectives</p>
                <div className="mt-2 space-y-1.5">
                  {RECOVERY_OBJECTIVES.map((objective) => (
                    <div key={objective.id} className="flex items-center justify-between text-sm">
                      <span>{objective.metric}</span>
                      <span className={cn("font-semibold", RECOVERY_STATUS_COLORS[objective.status])}>{objective.value}</span>
                      <span className="text-xs text-muted-foreground">Ziel: {objective.target}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => toast.success("Wiederherstellungstest geplant")}>Restore-Test starten</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
