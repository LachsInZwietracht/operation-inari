"use client"

import { use, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  Paperclip,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { useCounseling } from "@/hooks/use-counseling"
import { usePatients } from "@/hooks/use-patients"
import { formatDate } from "@/lib/format"
import type { CounselingMaterialStatus, CounselingTimelineStatus } from "@/lib/types"

export default function BeratungDetailPage({
  params,
}: {
  params: Promise<{ id: string; beratungId: string }>
}) {
  const { id, beratungId } = use(params)
  const { getPatient } = usePatients()
  const {
    getSession,
    addTimelineEntry,
    updateTimelineStatus,
    addMaterial,
    updateMaterialStatus,
    addProgressMetric,
    updateProgressMetric,
  } = useCounseling()

  const patient = getPatient(id)
  const session = getSession(beratungId)

  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false)
  const [timelineForm, setTimelineForm] = useState<{
    date: string
    title: string
    description: string
    status: CounselingTimelineStatus
  }>({
    date: session?.date ?? new Date().toISOString().slice(0, 10),
    title: "",
    description: "",
    status: "upcoming",
  })
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false)
  const [materialForm, setMaterialForm] = useState<{
    title: string
    type: string
    url: string
    status: CounselingMaterialStatus
    notes: string
  }>({
    title: "",
    type: "PDF",
    url: "",
    status: "shared",
    notes: "",
  })
  const [progressDialogOpen, setProgressDialogOpen] = useState(false)
  const [progressForm, setProgressForm] = useState({
    label: "",
    value: "",
    target: "",
    unit: "kg",
  })
  const [progressDrafts, setProgressDrafts] = useState<Record<string, string>>({})

  const timelineEntries = useMemo(
    () => [...(session?.timeline ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [session?.timeline],
  )
  const materialEntries = session?.materials ?? []
  const progressMetrics = session?.progress ?? []

  const resetTimelineForm = () =>
    setTimelineForm({
      date: session?.date ?? new Date().toISOString().slice(0, 10),
      title: "",
      description: "",
      status: "upcoming",
    })

  const resetMaterialForm = () =>
    setMaterialForm({ title: "", type: "PDF", url: "", status: "shared", notes: "" })

  const resetProgressForm = () =>
    setProgressForm({ label: "", value: "", target: "", unit: "kg" })

  const handleTimelineSubmit = () => {
    if (!session || !timelineForm.title.trim()) return
    addTimelineEntry(session.id, {
      date: timelineForm.date || session.date,
      title: timelineForm.title.trim(),
      description: timelineForm.description?.trim() || undefined,
      status: timelineForm.status,
    })
    resetTimelineForm()
    setTimelineDialogOpen(false)
  }

  const handleMaterialSubmit = () => {
    if (!session || !materialForm.title.trim()) return
    addMaterial(session.id, {
      title: materialForm.title.trim(),
      type: materialForm.type,
      url: materialForm.url || undefined,
      status: materialForm.status,
      notes: materialForm.notes?.trim() || undefined,
    })
    resetMaterialForm()
    setMaterialDialogOpen(false)
  }

  const handleProgressSubmit = () => {
    if (!session || !progressForm.label.trim()) return
    const value = Number(progressForm.value)
    const target = Number(progressForm.target)
    if (!Number.isFinite(value) || !Number.isFinite(target)) return
    addProgressMetric(session.id, {
      label: progressForm.label.trim(),
      value,
      target,
      unit: progressForm.unit || "",
      trend: value >= target ? "up" : "steady",
    })
    resetProgressForm()
    setProgressDialogOpen(false)
  }

  const cycleTimelineStatus = (status: CounselingTimelineStatus): CounselingTimelineStatus => {
    if (status === "done") return "active"
    if (status === "active") return "upcoming"
    return "done"
  }

  const cycleMaterialStatus = (status: CounselingMaterialStatus): CounselingMaterialStatus => {
    if (status === "pending") return "shared"
    if (status === "shared") return "viewed"
    return "pending"
  }

  const handleProgressUpdate = (metricId: string, target: number) => {
    if (!session) return
    const nextVal = Number(progressDrafts[metricId])
    if (!Number.isFinite(nextVal)) return
    const trend = nextVal >= target ? "up" : nextVal < target / 2 ? "down" : "steady"
    updateProgressMetric(session.id, metricId, nextVal, trend)
    setProgressDrafts((prev) => ({ ...prev, [metricId]: "" }))
  }

  if (!patient || !session) {
    return (
      <div className="space-y-6">
        <PageHeader title="Nicht gefunden" />
        <p className="text-sm text-muted-foreground">
          Beratung oder Patient wurde nicht gefunden.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/patienten/${id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zu {patient.firstName} {patient.lastName}
        </Link>
      </Button>

      <PageHeader
        title={`${session.type} – ${session.indication}`}
      >
        <Badge variant="outline">{session.duration} Min.</Badge>
      </PageHeader>

      <div className="text-sm text-muted-foreground">
        {formatDate(session.date)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Beratungsverlauf</CardTitle>
              <CardDescription>Timeline & Status der Maßnahmen.</CardDescription>
            </div>
            <Dialog open={timelineDialogOpen} onOpenChange={setTimelineDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  Ereignis hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Timeline-Ereignis</DialogTitle>
                  <DialogDescription>Dokumentieren Sie Zwischenschritte und Follow-ups.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label htmlFor="timeline-title">Titel</Label>
                    <Input
                      id="timeline-title"
                      value={timelineForm.title}
                      onChange={(event) =>
                        setTimelineForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="z. B. Bewegungsplan senden"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="timeline-date">Datum</Label>
                      <Input
                        id="timeline-date"
                        type="date"
                        value={timelineForm.date}
                        onChange={(event) =>
                          setTimelineForm((prev) => ({ ...prev, date: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={timelineForm.status}
                        onValueChange={(value) =>
                          setTimelineForm((prev) => ({ ...prev, status: value as CounselingTimelineStatus }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="done">abgeschlossen</SelectItem>
                          <SelectItem value="active">in Arbeit</SelectItem>
                          <SelectItem value="upcoming">offen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Beschreibung</Label>
                    <Textarea
                      rows={3}
                      value={timelineForm.description}
                      onChange={(event) =>
                        setTimelineForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="Notizen zum Schritt"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => { resetTimelineForm(); setTimelineDialogOpen(false) }}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleTimelineSubmit}>Speichern</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {timelineEntries.length > 0 ? (
              <ol className="space-y-4">
                {timelineEntries.map((entry, index) => (
                  <li key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {index === 0 ? (
                        <span className="rounded-full border border-border bg-background p-1">
                          <Clock3 className="h-4 w-4 text-muted-foreground" />
                        </span>
                      ) : (
                        <div className="h-4 w-px bg-border" />
                      )}
                      {index < timelineEntries.length - 1 && <div className="h-full w-px bg-border" />}
                    </div>
                    <div className="flex-1 rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{entry.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => updateTimelineStatus(session.id, entry.id, cycleTimelineStatus(entry.status))}
                        >
                          {entry.status === "done"
                            ? "abgeschlossen"
                            : entry.status === "active"
                              ? "in Arbeit"
                              : "offen"}
                        </Button>
                      </div>
                      {entry.description && (
                        <p className="mt-2 text-sm text-muted-foreground">{entry.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Timeline-Einträge gespeichert.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Materialien & Handouts</CardTitle>
              <CardDescription>Unterlagen, die dem Patienten bereitgestellt wurden.</CardDescription>
            </div>
            <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  Material anhängen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Material hinzufügen</DialogTitle>
                  <DialogDescription>Verlinken Sie PDFs, Handouts oder Dateien.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label htmlFor="material-title">Titel</Label>
                    <Input
                      id="material-title"
                      value={materialForm.title}
                      onChange={(event) =>
                        setMaterialForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="z. B. Ballaststoff-Checkliste"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label>Typ</Label>
                      <Select
                        value={materialForm.type}
                        onValueChange={(value) =>
                          setMaterialForm((prev) => ({ ...prev, type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PDF">PDF</SelectItem>
                          <SelectItem value="Handout">Handout</SelectItem>
                          <SelectItem value="Link">Link</SelectItem>
                          <SelectItem value="Video">Video</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={materialForm.status}
                        onValueChange={(value) =>
                          setMaterialForm((prev) => ({ ...prev, status: value as typeof materialForm.status }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Offen</SelectItem>
                          <SelectItem value="shared">Gesendet</SelectItem>
                          <SelectItem value="viewed">Gelesen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="material-url">Link/URL</Label>
                    <Input
                      id="material-url"
                      value={materialForm.url}
                      onChange={(event) =>
                        setMaterialForm((prev) => ({ ...prev, url: event.target.value }))
                      }
                      placeholder="https://"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Notizen</Label>
                    <Textarea
                      rows={3}
                      value={materialForm.notes}
                      onChange={(event) =>
                        setMaterialForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      placeholder="Hinweise zum Material"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => { resetMaterialForm(); setMaterialDialogOpen(false) }}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleMaterialSubmit}>Speichern</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-3">
            {materialEntries.length > 0 ? (
              materialEntries.map((material) => (
                <div key={material.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      {material.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {material.type}
                      {material.url ? ` · ${material.url}` : ""}
                    </p>
                    {material.notes && (
                      <p className="text-xs text-muted-foreground">{material.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {material.status === "pending"
                        ? "Offen"
                        : material.status === "shared"
                          ? "Gesendet"
                          : "Gesehen"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateMaterialStatus(session.id, material.id, cycleMaterialStatus(material.status))}
                    >
                      Status wechseln
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Materialien hinterlegt.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Fortschrittsindikatoren</CardTitle>
            <CardDescription>Visualisiert Zielerreichung dieser Sitzung.</CardDescription>
          </div>
          <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                Indikator hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Fortschritt erfassen</DialogTitle>
                <DialogDescription>Neue Ziele bzw. Messgrößen zur Beratung ergänzen.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="progress-label">Bezeichnung</Label>
                  <Input
                    id="progress-label"
                    value={progressForm.label}
                    onChange={(event) =>
                      setProgressForm((prev) => ({ ...prev, label: event.target.value }))
                    }
                    placeholder="z. B. Gewichtsreduktion"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="progress-value">Aktueller Wert</Label>
                    <Input
                      id="progress-value"
                      type="number"
                      value={progressForm.value}
                      onChange={(event) =>
                        setProgressForm((prev) => ({ ...prev, value: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="progress-target">Zielwert</Label>
                    <Input
                      id="progress-target"
                      type="number"
                      value={progressForm.target}
                      onChange={(event) =>
                        setProgressForm((prev) => ({ ...prev, target: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="progress-unit">Einheit</Label>
                  <Input
                    id="progress-unit"
                    value={progressForm.unit}
                    onChange={(event) =>
                      setProgressForm((prev) => ({ ...prev, unit: event.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => { resetProgressForm(); setProgressDialogOpen(false) }}>
                  Abbrechen
                </Button>
                <Button onClick={handleProgressSubmit}>Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          {progressMetrics.length > 0 ? (
            progressMetrics.map((metric) => {
              const completion = Math.min(110, (metric.value / (metric.target || 1)) * 100)
              return (
                <div key={metric.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{metric.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {metric.value} / {metric.target} {metric.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {metric.trend === "up" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-3.5 w-3.5" />}
                      {metric.trend === "up"
                        ? "auf Kurs"
                        : metric.trend === "down"
                          ? "unter Ziel"
                          : "stabil"}
                    </div>
                  </div>
                  <Progress value={completion} className="mt-2" />
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <Input
                      type="number"
                      placeholder="Neuer Wert"
                      className="w-32"
                      value={progressDrafts[metric.id] ?? ""}
                      onChange={(event) =>
                        setProgressDrafts((prev) => ({ ...prev, [metric.id]: event.target.value }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleProgressUpdate(metric.id, metric.target)}
                    >
                      Aktualisieren
                    </Button>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Indikatoren angelegt.</p>
          )}
        </CardContent>
      </Card>

      {session.goals && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Beratungsziele</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{session.goals}</p>
          </CardContent>
        </Card>
      )}

      <Card data-testid="counseling-session-documentation">
        <CardHeader>
          <CardTitle className="text-base" data-testid="counseling-session-documentation-title">
            Dokumentation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            data-testid="counseling-session-content"
            className="text-sm whitespace-pre-wrap font-mono leading-relaxed"
          >
            {session.content}
          </div>
        </CardContent>
      </Card>

      {session.recommendations && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empfehlungen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{session.recommendations}</p>
          </CardContent>
        </Card>
      )}

      {session.nextAppointment && (
        <Card>
          <CardContent className="flex items-center gap-2 pt-6">
            <span className="text-sm font-medium">Nächster Termin:</span>
            <span className="text-sm">{formatDate(session.nextAppointment)}</span>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
