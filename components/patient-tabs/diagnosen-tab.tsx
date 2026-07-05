"use client"

import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react"
import { AlertTriangle, Pill, Stethoscope, Trash2 } from "lucide-react"
import { toast } from "sonner"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/format"
import {
  ALLERGEN_DEFINITIONS,
  ALLERGEN_MAP,
  ALLERGEN_TYPE_LABELS,
  ALLERGEN_SEVERITY_LABELS,
  type AllergenType,
  type AllergenSeverity,
} from "@/lib/allergen-constants"
import type { DiagnosisEntry, MedicationEntry, PatientAllergenEntry } from "@/lib/types"

export interface DiagnosisFormState {
  diagnosis: string
  icdCode: string
  startDate: string
  notes: string
}

export interface MedicationFormState {
  name: string
  dosage: string
  schedule: string
  startDate: string
  reason: string
}

export interface AllergenFormState {
  allergenId: string
  type: AllergenType
  severity: AllergenSeverity
  diagnosedDate: string
  notes: string
}

interface DiagnosenTabProps {
  profileSubNav: ReactNode
  diagnoses: DiagnosisEntry[]
  diagnosesPending: boolean
  showDiagnosisForm: boolean
  setShowDiagnosisForm: Dispatch<SetStateAction<boolean>>
  diagnosisForm: DiagnosisFormState
  setDiagnosisForm: Dispatch<SetStateAction<DiagnosisFormState>>
  onDiagnosisSubmit: (event: FormEvent<HTMLFormElement>) => void
  medications: MedicationEntry[]
  medicationsPending: boolean
  showMedicationForm: boolean
  setShowMedicationForm: Dispatch<SetStateAction<boolean>>
  medicationForm: MedicationFormState
  setMedicationForm: Dispatch<SetStateAction<MedicationFormState>>
  onMedicationSubmit: (event: FormEvent<HTMLFormElement>) => void
  patientAllergens: PatientAllergenEntry[]
  allergensPending: boolean
  showAllergenForm: boolean
  setShowAllergenForm: Dispatch<SetStateAction<boolean>>
  allergenForm: AllergenFormState
  setAllergenForm: Dispatch<SetStateAction<AllergenFormState>>
  onAllergenSubmit: (event: FormEvent) => void
  onDeleteAllergen: (id: string) => void
}

export function DiagnosenTab({
  profileSubNav,
  diagnoses,
  diagnosesPending,
  showDiagnosisForm,
  setShowDiagnosisForm,
  diagnosisForm,
  setDiagnosisForm,
  onDiagnosisSubmit,
  medications,
  medicationsPending,
  showMedicationForm,
  setShowMedicationForm,
  medicationForm,
  setMedicationForm,
  onMedicationSubmit,
  patientAllergens,
  allergensPending,
  showAllergenForm,
  setShowAllergenForm,
  allergenForm,
  setAllergenForm,
  onAllergenSubmit,
  onDeleteAllergen,
}: DiagnosenTabProps) {
  return (
    <>
      {profileSubNav}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" /> Diagnosen
            </CardTitle>
            <CardDescription>Chronische Diagnosen, ICD-Codes und Anmerkungen.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowDiagnosisForm((prev) => !prev)}>
            {showDiagnosisForm ? "Abbrechen" : "Diagnose erfassen"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showDiagnosisForm && (
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onDiagnosisSubmit}>
              <div className="md:col-span-2">
                <Label htmlFor="diagnosis-name">Diagnose</Label>
                <Input
                  id="diagnosis-name"
                  value={diagnosisForm.diagnosis}
                  onChange={(event) => setDiagnosisForm((prev) => ({ ...prev, diagnosis: event.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="diagnosis-icd">ICD-Code</Label>
                <Input
                  id="diagnosis-icd"
                  value={diagnosisForm.icdCode}
                  onChange={(event) => setDiagnosisForm((prev) => ({ ...prev, icdCode: event.target.value }))}
                  placeholder="z. B. E11.9"
                />
              </div>
              <div>
                <Label htmlFor="diagnosis-start">Beginn</Label>
                <Input
                  type="date"
                  id="diagnosis-start"
                  value={diagnosisForm.startDate}
                  onChange={(event) => setDiagnosisForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="diagnosis-notes">Notizen</Label>
                <Textarea
                  id="diagnosis-notes"
                  rows={3}
                  value={diagnosisForm.notes}
                  onChange={(event) => setDiagnosisForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowDiagnosisForm(false)}>
                  Abbrechen
                </Button>
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          )}
          {diagnoses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Diagnose</TableHead>
                  <TableHead>ICD</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Notizen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diagnoses.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.diagnosis}</TableCell>
                    <TableCell>{entry.icdCode ?? "–"}</TableCell>
                    <TableCell>{formatDate(entry.startDate)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.notes ? entry.notes.slice(0, 64) : "–"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : diagnosesPending ? (
            <p className="text-sm text-muted-foreground">Diagnosen werden synchronisiert.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Diagnosen hinterlegt.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-4 w-4" /> Medikamente
            </CardTitle>
            <CardDescription>Dosierungen, Einnahmeschemata und Gründe.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowMedicationForm((prev) => !prev)}>
            {showMedicationForm ? "Abbrechen" : "Medikation erfassen"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showMedicationForm && (
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onMedicationSubmit}>
              <div>
                <Label htmlFor="med-name">Name</Label>
                <Input
                  id="med-name"
                  value={medicationForm.name}
                  onChange={(event) => setMedicationForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="med-dosage">Dosierung</Label>
                <Input
                  id="med-dosage"
                  placeholder="1000 mg"
                  value={medicationForm.dosage}
                  onChange={(event) => setMedicationForm((prev) => ({ ...prev, dosage: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="med-schedule">Schema</Label>
                <Input
                  id="med-schedule"
                  placeholder="2× täglich"
                  value={medicationForm.schedule}
                  onChange={(event) => setMedicationForm((prev) => ({ ...prev, schedule: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="med-start">Startdatum</Label>
                <Input
                  type="date"
                  id="med-start"
                  value={medicationForm.startDate}
                  onChange={(event) => setMedicationForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="med-reason">Grund</Label>
                <Textarea
                  id="med-reason"
                  rows={2}
                  value={medicationForm.reason}
                  onChange={(event) => setMedicationForm((prev) => ({ ...prev, reason: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowMedicationForm(false)}>
                  Abbrechen
                </Button>
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          )}
          {medications.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medikament</TableHead>
                  <TableHead>Dosierung</TableHead>
                  <TableHead>Schema</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Hinweis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medications.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell>{entry.dosage}</TableCell>
                    <TableCell>{entry.schedule}</TableCell>
                    <TableCell>{formatDate(entry.startDate)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.reason ?? entry.notes ?? "–"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : medicationsPending ? (
            <p className="text-sm text-muted-foreground">Medikationen werden synchronisiert.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Medikamente dokumentiert.</p>
          )}
          {medications.length > 0 && (
            <div>
              <p className="mt-4 text-xs uppercase text-muted-foreground">Einnahmehistorie</p>
              <div className="mt-2 space-y-2">
                {[...medications]
                  .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                  .map((entry) => (
                    <div key={`med_timeline_${entry.id}`} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        seit {formatDate(entry.startDate)} · {entry.dosage || "k.A."} · {entry.schedule || "Schema offen"}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Allergien & Intoleranzen
            </CardTitle>
            <CardDescription>Allergenprofile für Warnhinweise in Rezepten und Ernährungsplänen.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAllergenForm((prev) => !prev)}>
            {showAllergenForm ? "Abbrechen" : "Allergen erfassen"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAllergenForm && (
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onAllergenSubmit}>
              <div>
                <Label htmlFor="allergen-select">Allergen</Label>
                <Select
                  value={allergenForm.allergenId}
                  onValueChange={(v) => setAllergenForm((prev) => ({ ...prev, allergenId: v }))}
                >
                  <SelectTrigger id="allergen-select">
                    <SelectValue placeholder="Allergen wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLERGEN_DEFINITIONS.filter(
                      (def) => !patientAllergens.some((pa) => pa.allergenId === def.id),
                    ).map((def) => (
                      <SelectItem key={def.id} value={def.id}>
                        {def.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="allergen-type">Typ</Label>
                <Select
                  value={allergenForm.type}
                  onValueChange={(v) => setAllergenForm((prev) => ({ ...prev, type: v as AllergenType }))}
                >
                  <SelectTrigger id="allergen-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allergy">Allergie</SelectItem>
                    <SelectItem value="intolerance">Intoleranz</SelectItem>
                    <SelectItem value="preference">Präferenz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="allergen-severity">Schweregrad</Label>
                <Select
                  value={allergenForm.severity}
                  onValueChange={(v) => setAllergenForm((prev) => ({ ...prev, severity: v as AllergenSeverity }))}
                >
                  <SelectTrigger id="allergen-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Leicht</SelectItem>
                    <SelectItem value="moderate">Mittel</SelectItem>
                    <SelectItem value="severe">Schwer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="allergen-date">Diagnosedatum</Label>
                <Input
                  type="date"
                  id="allergen-date"
                  value={allergenForm.diagnosedDate}
                  onChange={(e) => setAllergenForm((prev) => ({ ...prev, diagnosedDate: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="allergen-notes">Notizen</Label>
                <Textarea
                  id="allergen-notes"
                  rows={2}
                  value={allergenForm.notes}
                  onChange={(e) => setAllergenForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowAllergenForm(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={!allergenForm.allergenId}>Speichern</Button>
              </div>
            </form>
          )}
          {patientAllergens.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {patientAllergens.map((entry) => {
                const def = ALLERGEN_MAP.get(entry.allergenId)
                const label = def?.label ?? entry.allergenId
                const variant = entry.type === "allergy" ? "destructive" as const : entry.type === "intolerance" ? "default" as const : "secondary" as const
                return (
                  <Badge
                    key={entry.id}
                    variant={variant}
                    className={`gap-1 ${entry.type === "intolerance" ? "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-100" : ""}`}
                  >
                    {label} · {ALLERGEN_TYPE_LABELS[entry.type]} · {ALLERGEN_SEVERITY_LABELS[entry.severity]}
                    <button
                      type="button"
                      className="ml-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                      onClick={() => {
                        onDeleteAllergen(entry.id)
                        toast.success(`${label} entfernt`)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          ) : allergensPending ? (
            <p className="text-sm text-muted-foreground">Allergene werden synchronisiert.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Allergene oder Intoleranzen hinterlegt.</p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
