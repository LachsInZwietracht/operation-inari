"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, formatNumber } from "@/lib/format"
import type {
  AnthropometricEntry,
  Patient,
  PatientCareSetting,
  PatientStatus,
  PreferredContactChannel,
} from "@/lib/types"

const PATIENT_STATUS_LABELS: Record<PatientStatus, string> = {
  active: "Aktiv",
  inactive: "Inaktiv",
  archived: "Archiviert",
  deceased: "Verstorben",
}

const CARE_SETTING_LABELS: Record<PatientCareSetting, string> = {
  ambulatory: "Ambulant",
  inpatient: "Stationär",
  discharged: "Entlassen",
}

const CONTACT_CHANNEL_LABELS: Record<PreferredContactChannel, string> = {
  phone: "Telefon",
  email: "E-Mail",
  mail: "Post",
  none: "Keine Angabe",
}

interface StammdatenTabProps {
  patient: Patient
  profileSubNav: ReactNode
  amputationDescriptions: string[]
  amputationFactor: number
  hasAmputation: boolean
  latestAnthro: AnthropometricEntry | null
  correctedWeight: number | null
  correctedBmi: number | null
}

export function StammdatenTab({
  patient,
  profileSubNav,
  amputationDescriptions,
  amputationFactor,
  hasAmputation,
  latestAnthro,
  correctedWeight,
  correctedBmi,
}: StammdatenTabProps) {
  return (
    <>
      {profileSubNav}
      <Card>
        <CardHeader>
          <CardTitle>Persönliche Daten</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Geburtsdatum</dt>
              <dd className="text-sm font-medium">{formatDate(patient.dateOfBirth)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Geschlecht</dt>
              <dd className="text-sm font-medium">
                {patient.gender === "m" ? "Männlich" : patient.gender === "w" ? "Weiblich" : "Divers"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="text-sm font-medium">
                <Badge variant={patient.status === "active" || !patient.status ? "secondary" : "outline"}>
                  {PATIENT_STATUS_LABELS[patient.status ?? "active"]}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Versorgungskontext</dt>
              <dd className="text-sm font-medium">{CARE_SETTING_LABELS[patient.careSetting ?? "ambulatory"]}</dd>
            </div>
            {patient.externalPatientNumber && (
              <div>
                <dt className="text-sm text-muted-foreground">Patientennummer</dt>
                <dd className="text-sm font-medium">{patient.externalPatientNumber}</dd>
              </div>
            )}
            {patient.caseNumber && (
              <div>
                <dt className="text-sm text-muted-foreground">Fallnummer</dt>
                <dd className="text-sm font-medium">{patient.caseNumber}</dd>
              </div>
            )}
            {patient.email && (
              <div>
                <dt className="text-sm text-muted-foreground">E-Mail</dt>
                <dd className="text-sm font-medium">{patient.email}</dd>
              </div>
            )}
            {patient.phone && (
              <div>
                <dt className="text-sm text-muted-foreground">Telefon</dt>
                <dd className="text-sm font-medium">{patient.phone}</dd>
              </div>
            )}
            {patient.preferredContactChannel && (
              <div>
                <dt className="text-sm text-muted-foreground">Bevorzugter Kontakt</dt>
                <dd className="text-sm font-medium">{CONTACT_CHANNEL_LABELS[patient.preferredContactChannel]}</dd>
              </div>
            )}
            {patient.preferredLanguage && (
              <div>
                <dt className="text-sm text-muted-foreground">Sprache</dt>
                <dd className="text-sm font-medium">{patient.preferredLanguage}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted-foreground">Kontaktfreigabe</dt>
              <dd className="text-sm font-medium">{patient.communicationConsent ? "Ja" : "Nein"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Digitale Protokolle</dt>
              <dd className="text-sm font-medium">{patient.digitalProtocolConsent ? "Freigegeben" : "Nicht freigegeben"}</dd>
            </div>
            {patient.street && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Adresse</dt>
                <dd className="text-sm font-medium">
                  {patient.street}, {patient.zip} {patient.city}
                </dd>
              </div>
            )}
            {(patient.emergencyContactName || patient.emergencyContactPhone) && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Kontaktperson</dt>
                <dd className="text-sm font-medium">
                  {[patient.emergencyContactName, patient.emergencyContactRelationship, patient.emergencyContactPhone]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Versicherung & Medizinisches</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {patient.insuranceProvider && (
              <div>
                <dt className="text-sm text-muted-foreground">Krankenkasse</dt>
                <dd className="text-sm font-medium">{patient.insuranceProvider}</dd>
              </div>
            )}
            {patient.insuranceNumber && (
              <div>
                <dt className="text-sm text-muted-foreground">Versichertennummer</dt>
                <dd className="text-sm font-medium">{patient.insuranceNumber}</dd>
              </div>
            )}
            {patient.indications && patient.indications.length > 0 && (
              <div>
                <dt className="text-sm text-muted-foreground">
                  {patient.indications.length === 1 ? "Indikation" : "Indikationen"}
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5 text-sm font-medium">
                  {patient.indications.map((indication) => (
                    <Badge key={indication} variant="secondary">
                      {indication}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
            {patient.referrerName && (
              <div>
                <dt className="text-sm text-muted-foreground">Zuweiser</dt>
                <dd className="text-sm font-medium">{patient.referrerName}</dd>
              </div>
            )}
            {patient.department && (
              <div>
                <dt className="text-sm text-muted-foreground">Fachbereich / Station</dt>
                <dd className="text-sm font-medium">{patient.department}</dd>
              </div>
            )}
            {amputationDescriptions.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Amputationen</dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  {amputationDescriptions.map((label) => (
                    <Badge key={label} variant="outline">
                      {label.replace(/\s*\([^)]*\)/, "")}
                    </Badge>
                  ))}
                </dd>
                <p className="text-xs text-muted-foreground">
                  BMI-Korrektur: {(amputationFactor * 100).toFixed(1)} %
                </p>
              </div>
            )}
          </dl>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {patient.intakeReason && (
              <div>
                <dt className="text-sm text-muted-foreground">Aufnahmegrund</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm">{patient.intakeReason}</dd>
              </div>
            )}
            {patient.patientGoals && (
              <div>
                <dt className="text-sm text-muted-foreground">Patientenziele</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm">{patient.patientGoals}</dd>
              </div>
            )}
            {(patient.clinicalNotes || patient.notes) && (
              <div>
                <dt className="text-sm text-muted-foreground">Klinische Notizen</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm">{patient.clinicalNotes ?? patient.notes}</dd>
              </div>
            )}
            {patient.adminNotes && (
              <div>
                <dt className="text-sm text-muted-foreground">Administrative Notizen</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm">{patient.adminNotes}</dd>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {latestAnthro && (
        <Card>
          <CardHeader>
            <CardTitle>Aktuelle Messwerte</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-sm text-muted-foreground">Gewicht</dt>
                <dd className="text-lg font-semibold">
                  {formatNumber(latestAnthro.weight, 1)} kg
                </dd>
                {hasAmputation && correctedWeight && (
                  <p className="text-xs text-muted-foreground">
                    Korrigiert: {formatNumber(correctedWeight, 1)} kg
                  </p>
                )}
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Größe</dt>
                <dd className="text-lg font-semibold">{formatNumber(latestAnthro.height, 0)} cm</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">BMI</dt>
                <dd className="text-lg font-semibold">
                  {formatNumber(correctedBmi ?? latestAnthro.bmi, 1)}
                </dd>
                {hasAmputation && (
                  <p className="text-xs text-muted-foreground">
                    Gemessen: {formatNumber(latestAnthro.bmi, 1)}
                  </p>
                )}
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Datum</dt>
                <dd className="text-lg font-semibold">{formatDate(latestAnthro.date)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </>
  )
}
