"use client"

import type { FormEvent, ReactNode } from "react"
import { FlaskConical } from "lucide-react"
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
import { downloadCsv } from "@/lib/utils"
import { LAB_PARAMETERS } from "@/lib/reference-data/lab-parameters"
import type { LabValueEntry, Patient } from "@/lib/types"

function complianceBadge(value: number, min?: number, max?: number): "ok" | "low" | "high" {
  if (typeof min === "number" && value < min) return "low"
  if (typeof max === "number" && value > max) return "high"
  return "ok"
}

interface LaborwerteTabProps {
  patient: Patient
  profileSubNav: ReactNode
  labParameterId: string
  setLabParameterId: (value: string) => void
  labValueInput: string
  setLabValueInput: (value: string) => void
  labDateInput: string
  setLabDateInput: (value: string) => void
  labNotesInput: string
  setLabNotesInput: (value: string) => void
  entriesForSelectedLab: LabValueEntry[]
  labValuesPending: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function LaborwerteTab({
  patient,
  profileSubNav,
  labParameterId,
  setLabParameterId,
  labValueInput,
  setLabValueInput,
  labDateInput,
  setLabDateInput,
  labNotesInput,
  setLabNotesInput,
  entriesForSelectedLab,
  labValuesPending,
  onSubmit,
}: LaborwerteTabProps) {
  const selectedLabParameter = LAB_PARAMETERS.find((param) => param.id === labParameterId)

  return (
    <>
      {profileSubNav}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" /> Laborpanel
            </CardTitle>
            <CardDescription>
              {selectedLabParameter?.description ?? "Parameter wählen und neue Messung erfassen."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-4" onSubmit={onSubmit}>
            <div className="md:col-span-2">
              <Label>Parameter</Label>
              <Select value={labParameterId} onValueChange={setLabParameterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Parameter wählen" />
                </SelectTrigger>
                <SelectContent>
                  {LAB_PARAMETERS.map((param) => (
                    <SelectItem key={param.id} value={param.id}>
                      {param.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                Wert {selectedLabParameter ? `(${selectedLabParameter.unit})` : ""}
              </Label>
              <Input
                value={labValueInput}
                onChange={(event) => setLabValueInput(event.target.value)}
                required
                placeholder="z. B. 5.6"
              />
            </div>
            <div>
              <Label>Datum</Label>
              <Input
                type="date"
                value={labDateInput}
                onChange={(event) => setLabDateInput(event.target.value)}
              />
            </div>
            <div className="md:col-span-4">
              <Label>Notiz</Label>
              <Textarea
                rows={2}
                value={labNotesInput}
                onChange={(event) => setLabNotesInput(event.target.value)}
                placeholder="z. B. nüchtern, Labor Praxis X"
              />
            </div>
            <div className="md:col-span-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!selectedLabParameter || entriesForSelectedLab.length === 0) {
                    toast.error("Keine Messungen für Export vorhanden")
                    return
                  }
                  const rows = [
                    ["Datum", "Wert", "Einheit", "Notiz"],
                    ...entriesForSelectedLab.map((entry) => [
                      formatDate(entry.date),
                      entry.value.toString(),
                      selectedLabParameter.unit,
                      entry.notes ?? "",
                    ]),
                  ]
                  downloadCsv(`${patient.lastName}_${selectedLabParameter.shortName}`, rows)
                  toast.success("CSV exportiert")
                }}
              >
                CSV Export
              </Button>
              <Button type="submit">Messung speichern</Button>
            </div>
          </form>

          {selectedLabParameter && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selectedLabParameter.name}</p>
                  <p className="text-muted-foreground text-xs">
                    Referenz {selectedLabParameter.referenceMin}–{selectedLabParameter.referenceMax}{' '}
                    {selectedLabParameter.unit}
                  </p>
                </div>
                {entriesForSelectedLab.length > 0 && (
                  <Badge
                    variant="outline"
                    className={
                      complianceBadge(
                        entriesForSelectedLab[entriesForSelectedLab.length - 1].value,
                        selectedLabParameter.referenceMin,
                        selectedLabParameter.referenceMax,
                      ) === "ok"
                        ? "border-emerald-200 text-emerald-700"
                        : "border-amber-200 text-amber-700"
                    }
                  >
                    {entriesForSelectedLab[entriesForSelectedLab.length - 1].value}
                    {selectedLabParameter.unit}
                  </Badge>
                )}
              </div>
              <div className="mt-3 flex items-end gap-1">
                {entriesForSelectedLab.slice(-16).map((entry) => {
                  const percent = selectedLabParameter.referenceMax
                    ? Math.min(100, (entry.value / selectedLabParameter.referenceMax) * 100)
                    : 0
                  return (
                    <span
                      key={entry.id}
                      className="w-2 rounded-full bg-primary/60"
                      style={{ height: `${Math.max(15, percent)}px` }}
                      title={`${formatDate(entry.date)} · ${entry.value} ${selectedLabParameter.unit}`}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verlauf</CardTitle>
          <CardDescription>Chronologische Auflistung für den gewählten Parameter.</CardDescription>
        </CardHeader>
        <CardContent>
          {entriesForSelectedLab.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Wert</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notiz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...entriesForSelectedLab].reverse().map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>
                      {entry.value} {selectedLabParameter?.unit}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          selectedLabParameter &&
                          complianceBadge(
                            entry.value,
                            selectedLabParameter.referenceMin,
                            selectedLabParameter.referenceMax,
                          ) !== "ok"
                            ? "border-amber-200 text-amber-700"
                            : "border-emerald-200 text-emerald-700"
                        }
                      >
                        {selectedLabParameter
                          ? complianceBadge(
                              entry.value,
                              selectedLabParameter.referenceMin,
                              selectedLabParameter.referenceMax,
                            ) === "ok"
                              ? "im Referenzbereich"
                              : "außerhalb"
                          : "–"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.notes ?? "–"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : labValuesPending ? (
            <p className="text-sm text-muted-foreground">Laborwerte werden synchronisiert.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Werte dokumentiert.</p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
