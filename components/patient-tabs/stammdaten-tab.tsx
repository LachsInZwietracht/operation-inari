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

/**
 * One recorded fact, label over value.
 *
 * The profile used to give every fact a full row of a two-column definition
 * list, which turned twelve short answers into a screen of scrolling. Stacked
 * tight in a four-column grid they read as what they are: a reference sheet.
 */
function Fact({
  label,
  value,
  className,
}: {
  label: string
  value?: ReactNode
  className?: string
}) {
  if (value === undefined || value === null || value === "") return null
  return (
    <div className={className}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  )
}

/** A block of free text — kept apart from the facts, which are one line each. */
function Note({ label, text }: { label: string; text?: string }) {
  if (!text) return null
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{text}</p>
    </div>
  )
}

const FACT_GRID = "grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4"

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
  const address = patient.street
    ? [patient.street, [patient.zip, patient.city].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ")
    : undefined
  const emergencyContact = [
    patient.emergencyContactName,
    patient.emergencyContactRelationship,
    patient.emergencyContactPhone,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      {profileSubNav}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Person und Kontakt</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className={FACT_GRID}>
            <Fact label="Geburtsdatum" value={formatDate(patient.dateOfBirth)} />
            <Fact
              label="Geschlecht"
              value={
                patient.gender === "m"
                  ? "Männlich"
                  : patient.gender === "w"
                    ? "Weiblich"
                    : "Divers"
              }
            />
            <Fact
              label="Status"
              value={
                <Badge
                  variant={
                    patient.status === "active" || !patient.status ? "secondary" : "outline"
                  }
                >
                  {PATIENT_STATUS_LABELS[patient.status ?? "active"]}
                </Badge>
              }
            />
            <Fact
              label="Versorgung"
              value={CARE_SETTING_LABELS[patient.careSetting ?? "ambulatory"]}
            />
            <Fact label="E-Mail" value={patient.email} />
            <Fact label="Telefon" value={patient.phone} />
            <Fact
              label="Bevorzugter Kontakt"
              value={
                patient.preferredContactChannel
                  ? CONTACT_CHANNEL_LABELS[patient.preferredContactChannel]
                  : undefined
              }
            />
            <Fact label="Sprache" value={patient.preferredLanguage} />
            <Fact label="Kontaktfreigabe" value={patient.communicationConsent ? "Ja" : "Nein"} />
            <Fact label="Adresse" value={address} className="col-span-2" />
            <Fact label="Kontaktperson" value={emergencyContact || undefined} className="col-span-2" />
            <Fact label="Patientennummer" value={patient.externalPatientNumber} />
            <Fact label="Fallnummer" value={patient.caseNumber} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Versicherung und Medizinisches</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className={FACT_GRID}>
            <Fact label="Krankenkasse" value={patient.insuranceProvider} />
            <Fact label="Versichertennummer" value={patient.insuranceNumber} />
            <Fact label="Zuweiser" value={patient.referrerName} />
            <Fact label="Fachbereich / Station" value={patient.department} />
            <Fact
              label={patient.indications?.length === 1 ? "Indikation" : "Indikationen"}
              className="col-span-2"
              value={
                patient.indications?.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {patient.indications.map((indication) => (
                      <Badge key={indication} variant="secondary">
                        {indication}
                      </Badge>
                    ))}
                  </span>
                ) : undefined
              }
            />
            <Fact
              label="Amputationen"
              className="col-span-2"
              value={
                amputationDescriptions.length ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    {amputationDescriptions.map((label) => (
                      <Badge key={label} variant="outline">
                        {label.replace(/\s*\([^)]*\)/, "")}
                      </Badge>
                    ))}
                    <span className="text-xs font-normal text-muted-foreground">
                      BMI-Korrektur {(amputationFactor * 100).toFixed(1)} %
                    </span>
                  </span>
                ) : undefined
              }
            />
          </dl>

          {patient.intakeReason ||
          patient.patientGoals ||
          patient.clinicalNotes ||
          patient.notes ||
          patient.adminNotes ? (
            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <Note label="Aufnahmegrund" text={patient.intakeReason} />
              <Note label="Patientenziele" text={patient.patientGoals} />
              <Note label="Klinische Notizen" text={patient.clinicalNotes ?? patient.notes} />
              <Note label="Administrative Notizen" text={patient.adminNotes} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Only when the amputation correction has something to say. The plain
          weight, height, BMI and measurement date are already the first thing
          the overview shows, and repeating them here was a card of nothing. */}
      {latestAnthro && hasAmputation && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Korrigierte Messwerte</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className={FACT_GRID}>
              <Fact
                label="Gewicht korrigiert"
                value={
                  correctedWeight ? (
                    <>
                      {formatNumber(correctedWeight, 1)} kg
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        gemessen {formatNumber(latestAnthro.weight, 1)} kg
                      </span>
                    </>
                  ) : undefined
                }
              />
              <Fact
                label="BMI korrigiert"
                value={
                  correctedBmi ? (
                    <>
                      {formatNumber(correctedBmi, 1)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        gemessen {formatNumber(latestAnthro.bmi, 1)}
                      </span>
                    </>
                  ) : undefined
                }
              />
              <Fact label="Größe" value={`${formatNumber(latestAnthro.height, 0)} cm`} />
              <Fact label="Stand" value={formatDate(latestAnthro.date)} />
            </dl>
          </CardContent>
        </Card>
      )}
    </>
  )
}
