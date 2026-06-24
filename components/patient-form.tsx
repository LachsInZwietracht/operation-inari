"use client"

import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, ChevronDown, CreditCard, FileText, Stethoscope, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

import { AMPUTATION_AREAS, INDICATION_OPTIONS } from "@/lib/constants"
import type {
  EgkCardData,
  Gender,
  Patient,
  PatientCareSetting,
  PatientStatus,
  PreferredContactChannel,
} from "@/lib/types"
import { useEgkScanner } from "@/hooks/use-egk-scanner"

const NO_CONTACT_CHANNEL_VALUE = "__none__"

const patientSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  dateOfBirth: z.string().min(1, "Geburtsdatum ist erforderlich"),
  gender: z.enum(["m", "w", "d"] as const),
  email: z.string().email("Ungültige E-Mail-Adresse").or(z.literal("")),
  phone: z.string(),
  street: z.string(),
  zip: z.string(),
  city: z.string(),
  insuranceProvider: z.string(),
  insuranceNumber: z.string(),
  indications: z.array(z.string()),
  notes: z.string(),
  amputations: z.array(z.string()),
  status: z.enum(["active", "inactive", "archived", "deceased"] as const),
  careSetting: z.enum(["ambulatory", "inpatient", "discharged"] as const),
  externalPatientNumber: z.string(),
  caseNumber: z.string(),
  preferredContactChannel: z.enum(["phone", "email", "mail", "none"] as const).optional(),
  preferredLanguage: z.string(),
  communicationConsent: z.boolean(),
  digitalProtocolConsent: z.boolean(),
  referrerName: z.string(),
  department: z.string(),
  intakeReason: z.string(),
  patientGoals: z.string(),
  clinicalNotes: z.string(),
  adminNotes: z.string(),
  emergencyContactName: z.string(),
  emergencyContactPhone: z.string(),
  emergencyContactRelationship: z.string(),
})

type PatientFormValues = z.infer<typeof patientSchema>

const GENDER_LABELS: Record<Gender, string> = {
  m: "Männlich",
  w: "Weiblich",
  d: "Divers",
}

const STATUS_LABELS: Record<PatientStatus, string> = {
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

type SubmitIntent = "overview" | "detail" | "counseling"

interface PatientFormProps {
  patient?: Patient
  onSubmit: (values: Omit<Patient, "id" | "createdAt" | "updatedAt">) => void | Promise<unknown>
  isEditing?: boolean
  existingPatients?: Patient[]
}

export function PatientForm({ patient, onSubmit, isEditing, existingPatients = [] }: PatientFormProps) {
  const router = useRouter()
  const [submitIntent, setSubmitIntent] = useState<SubmitIntent>("detail")
  const [showAmputations, setShowAmputations] = useState(() => (patient?.amputations?.length ?? 0) > 0)
  const {
    status: egkStatus,
    isSupported: egkSupported,
    connect: connectEgk,
    scanCard,
    simulateCard,
    isReading: isEgkReading,
    isConnecting: isEgkConnecting,
    lastCard,
    lastError,
  } = useEgkScanner()

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: patient?.firstName ?? "",
      lastName: patient?.lastName ?? "",
      dateOfBirth: patient?.dateOfBirth ?? "",
      gender: patient?.gender ?? "w",
      email: patient?.email ?? "",
      phone: patient?.phone ?? "",
      street: patient?.street ?? "",
      zip: patient?.zip ?? "",
      city: patient?.city ?? "",
      insuranceProvider: patient?.insuranceProvider ?? "",
      insuranceNumber: patient?.insuranceNumber ?? "",
      indications: patient?.indications ?? [],
      notes: patient?.notes ?? "",
      amputations: patient?.amputations ?? [],
      status: patient?.status ?? "active",
      careSetting: patient?.careSetting ?? "ambulatory",
      externalPatientNumber: patient?.externalPatientNumber ?? "",
      caseNumber: patient?.caseNumber ?? "",
      preferredContactChannel: patient?.preferredContactChannel,
      preferredLanguage: patient?.preferredLanguage ?? "Deutsch",
      communicationConsent: patient?.communicationConsent ?? false,
      digitalProtocolConsent: patient?.digitalProtocolConsent ?? false,
      referrerName: patient?.referrerName ?? "",
      department: patient?.department ?? "",
      intakeReason: patient?.intakeReason ?? "",
      patientGoals: patient?.patientGoals ?? "",
      clinicalNotes: patient?.clinicalNotes ?? patient?.notes ?? "",
      adminNotes: patient?.adminNotes ?? "",
      emergencyContactName: patient?.emergencyContactName ?? "",
      emergencyContactPhone: patient?.emergencyContactPhone ?? "",
      emergencyContactRelationship: patient?.emergencyContactRelationship ?? "",
    },
  })

  const watchedIdentity = form.watch(["firstName", "lastName", "dateOfBirth", "insuranceNumber", "externalPatientNumber"])

  const duplicateCandidates = useMemo(() => {
    const [firstName, lastName, dateOfBirth, insuranceNumber, externalPatientNumber] = watchedIdentity
    const normalizedFirstName = firstName.trim().toLowerCase()
    const normalizedLastName = lastName.trim().toLowerCase()
    const normalizedInsurance = insuranceNumber.trim().toLowerCase()
    const normalizedExternalId = externalPatientNumber.trim().toLowerCase()

    if (!normalizedLastName && !dateOfBirth && !normalizedInsurance && !normalizedExternalId) return []

    return existingPatients
      .filter((candidate) => candidate.id !== patient?.id && candidate.legacyId !== patient?.id)
      .map((candidate) => {
        const reasons: string[] = []
        if (normalizedInsurance && candidate.insuranceNumber?.trim().toLowerCase() === normalizedInsurance) {
          reasons.push("Versichertennummer")
        }
        if (normalizedExternalId && candidate.externalPatientNumber?.trim().toLowerCase() === normalizedExternalId) {
          reasons.push("Patientennummer")
        }
        if (
          normalizedFirstName &&
          normalizedLastName &&
          dateOfBirth &&
          candidate.firstName.trim().toLowerCase() === normalizedFirstName &&
          candidate.lastName.trim().toLowerCase() === normalizedLastName &&
          candidate.dateOfBirth === dateOfBirth
        ) {
          reasons.push("Name und Geburtsdatum")
        }
        return { patient: candidate, reasons }
      })
      .filter((entry) => entry.reasons.length > 0)
      .slice(0, 3)
  }, [existingPatients, patient?.id, watchedIdentity])

  const applyCardData = useCallback(
    (card: EgkCardData) => {
      form.setValue("firstName", card.firstName, { shouldDirty: true })
      form.setValue("lastName", card.lastName, { shouldDirty: true })
      form.setValue("dateOfBirth", card.dateOfBirth, { shouldDirty: true })
      form.setValue("gender", card.gender, { shouldDirty: true })
      form.setValue("street", card.street, { shouldDirty: true })
      form.setValue("zip", card.zip, { shouldDirty: true })
      form.setValue("city", card.city, { shouldDirty: true })
      form.setValue("insuranceProvider", card.insuranceProvider, { shouldDirty: true })
      form.setValue("insuranceNumber", card.insuranceNumber, { shouldDirty: true })
    },
    [form],
  )

  const handleEgkScan = useCallback(async () => {
    try {
      const card = await scanCard()
      applyCardData(card)
      toast.success("Demo-eGK-Daten übernommen")
    } catch (error) {
      toast.error((error as Error).message || "Demo-Karte konnte nicht eingelesen werden")
    }
  }, [applyCardData, scanCard])

  const handleEgkSimulation = useCallback(() => {
    const card = simulateCard()
    applyCardData(card)
    toast.info("Demokarte übernommen")
  }, [applyCardData, simulateCard])

  const egkStatusLabel: Record<string, string> = {
    disconnected: "Getrennt",
    connecting: "Verbindung wird aufgebaut",
    ready: "Bereit",
    reading: "Karte wird gelesen",
    error: "Fehler",
  }

  async function handleSubmit(values: PatientFormValues) {
    try {
      const savedPatient = await Promise.resolve(
        onSubmit({
          firstName: values.firstName,
          lastName: values.lastName,
          dateOfBirth: values.dateOfBirth,
          gender: values.gender,
          email: values.email || undefined,
          phone: values.phone || undefined,
          street: values.street || undefined,
          zip: values.zip || undefined,
          city: values.city || undefined,
          insuranceProvider: values.insuranceProvider || undefined,
          insuranceNumber: values.insuranceNumber || undefined,
          indications: values.indications.length > 0 ? values.indications : undefined,
          notes: values.clinicalNotes || values.notes || undefined,
          amputations: values.amputations && values.amputations.length > 0 ? values.amputations : undefined,
          status: values.status,
          careSetting: values.careSetting,
          externalPatientNumber: values.externalPatientNumber || undefined,
          caseNumber: values.caseNumber || undefined,
          preferredContactChannel: values.preferredContactChannel,
          preferredLanguage: values.preferredLanguage || undefined,
          communicationConsent: values.communicationConsent,
          digitalProtocolConsent: values.digitalProtocolConsent,
          referrerName: values.referrerName || undefined,
          department: values.department || undefined,
          intakeReason: values.intakeReason || undefined,
          patientGoals: values.patientGoals || undefined,
          clinicalNotes: values.clinicalNotes || undefined,
          adminNotes: values.adminNotes || undefined,
          emergencyContactName: values.emergencyContactName || undefined,
          emergencyContactPhone: values.emergencyContactPhone || undefined,
          emergencyContactRelationship: values.emergencyContactRelationship || undefined,
        }),
      )
      toast.success(isEditing ? "Patient aktualisiert!" : "Patient erstellt!")
      const savedId = typeof savedPatient === "object" && savedPatient && "id" in savedPatient
        ? String((savedPatient as Patient).id)
        : patient?.id
      if (isEditing || submitIntent === "overview" || !savedId) {
        router.push("/patienten")
      } else if (submitIntent === "counseling") {
        router.push(`/patienten/${savedId}/beratungen/neu`)
      } else {
        router.push(`/patienten/${savedId}`)
      }
    } catch (error) {
      console.error("Failed to submit patient form:", error)
      toast.error("Patient konnte nicht gespeichert werden")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                Aufnahme per eGK-Demo
              </CardTitle>
              <CardDescription>
                Simulieren Sie eGK-Stammdaten für Tests und Demos.
              </CardDescription>
            </div>
            <Badge variant={egkStatus === "ready" ? "secondary" : "outline"}>{egkStatusLabel[egkStatus]}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {!egkSupported && (
              <p className="text-sm text-muted-foreground">
                Ihr Browser unterstützt aktuell keine Demo-Web-Serial-Verbindung. Nutzen Sie die Demo-Schaltfläche.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={egkStatus === "ready" || isEgkConnecting}
                onClick={() => void connectEgk()}
              >
                {isEgkConnecting ? "Verbinde Demo..." : "Demo-Leser verbinden"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={egkStatus !== "ready" || isEgkReading}
                onClick={() => void handleEgkScan()}
              >
                {isEgkReading ? "Lese Demo-Karte..." : "Demo-Karte einlesen"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleEgkSimulation}>
                Demo-Karte nutzen
              </Button>
            </div>
            {lastCard && (
              <div className="rounded-md border bg-background p-3 text-sm">
                <p className="font-medium">
                  Zuletzt simuliert: {lastCard.firstName} {lastCard.lastName}
                </p>
                <p className="text-muted-foreground">
                  {lastCard.street}, {lastCard.zip} {lastCard.city} · {lastCard.insuranceProvider}
                </p>
              </div>
            )}
            {lastError && <p className="text-sm text-destructive">{lastError}</p>}
          </CardContent>
        </Card>

        {duplicateCandidates.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Mögliche Dublette</AlertTitle>
            <AlertDescription>
              <div className="space-y-1">
                {duplicateCandidates.map((entry) => (
                  <p key={entry.patient.id}>
                    {entry.patient.lastName}, {entry.patient.firstName} · {entry.reasons.join(", ")}
                  </p>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-md border p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-sm font-medium">Schnellaufnahme</p>
              <p className="text-xs text-muted-foreground">Name, Geburtsdatum und Indikation reichen zum Start.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Stethoscope className="mt-0.5 h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-medium">Klinischer Kontext</p>
              <p className="text-xs text-muted-foreground">Grund, Ziele und Zuweiser steuern die weitere Beratung.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border p-3">
            <FileText className="mt-0.5 h-4 w-4 text-amber-600" />
            <div>
              <p className="text-sm font-medium">Folgeworkflow</p>
              <p className="text-xs text-muted-foreground">Nach dem Speichern direkt in Akte oder Erstberatung springen.</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              Identität & Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vorname</FormLabel>
                    <FormControl>
                      <Input placeholder="Vorname" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nachname</FormLabel>
                    <FormControl>
                      <Input placeholder="Nachname" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geburtsdatum</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geschlecht</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Geschlecht wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.entries(GENDER_LABELS) as [Gender, string][]).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Status wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.entries(STATUS_LABELS) as [PatientStatus, string][]).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="careSetting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Versorgungskontext</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Kontext wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.entries(CARE_SETTING_LABELS) as [PatientCareSetting, string][]).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Hilft bei Praxis-, Stations- und Entlass-Workflows.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="externalPatientNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patientennummer</FormLabel>
                    <FormControl>
                      <Input placeholder="KIS-/Praxis-ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="caseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fallnummer</FormLabel>
                    <FormControl>
                      <Input placeholder="Optionaler Behandlungsfall" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-Mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="E-Mail" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="Telefon" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="preferredContactChannel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bevorzugter Kontakt</FormLabel>
                    <Select
                      value={field.value ?? NO_CONTACT_CHANNEL_VALUE}
                      onValueChange={(value) => field.onChange(value === NO_CONTACT_CHANNEL_VALUE ? undefined : value)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Kontaktweg wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_CONTACT_CHANNEL_VALUE}>Keine Angabe</SelectItem>
                        {(Object.entries(CONTACT_CHANNEL_LABELS) as [PreferredContactChannel, string][])
                          .filter(([value]) => value !== "none")
                          .map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preferredLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sprache</FormLabel>
                    <FormControl>
                      <Input placeholder="z. B. Deutsch" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="communicationConsent"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-md border p-3">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Kontaktfreigabe liegt vor</FormLabel>
                      <FormDescription>E-Mail, Telefon oder Post für Praxis-Kommunikation.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="digitalProtocolConsent"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-md border p-3">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Digitale Protokolle freigegeben</FormLabel>
                      <FormDescription>Patient darf öffentliche Protokoll-Links erhalten.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adresse & Bezugsperson</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Straße</FormLabel>
                  <FormControl>
                    <Input placeholder="Straße und Hausnummer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="zip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PLZ</FormLabel>
                    <FormControl>
                      <Input placeholder="PLZ" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Ort</FormLabel>
                    <FormControl>
                      <Input placeholder="Ort" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kontaktperson</FormLabel>
                    <FormControl>
                      <Input placeholder="Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergencyContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon Kontaktperson</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="Telefon" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergencyContactRelationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beziehung</FormLabel>
                    <FormControl>
                      <Input placeholder="z. B. Angehörige" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medizinische Daten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="insuranceProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Krankenkasse</FormLabel>
                    <FormControl>
                      <Input placeholder="Krankenkasse" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="insuranceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Versichertennummer</FormLabel>
                    <FormControl>
                      <Input placeholder="Versichertennummer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="indications"
              render={() => {
                const selected = form.watch("indications") ?? []
                const toggleIndication = (indication: string) => {
                  const current = new Set(form.getValues("indications"))
                  if (current.has(indication)) {
                    current.delete(indication)
                  } else {
                    current.add(indication)
                  }
                  form.setValue("indications", Array.from(current), { shouldDirty: true })
                }
                return (
                  <FormItem>
                    <FormLabel>Indikationen</FormLabel>
                    <FormDescription>
                      Mehrfachauswahl möglich, z. B. Diabetes mellitus Typ 2 und Adipositas.
                    </FormDescription>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-2 h-auto min-h-10 w-full justify-between gap-2 px-3 py-2 text-left font-normal"
                        >
                          <div className="flex flex-1 flex-wrap gap-1.5">
                            {selected.length === 0 ? (
                              <span className="text-muted-foreground">Indikationen auswählen</span>
                            ) : (
                              selected.map((indication) => (
                                <Badge key={indication} variant="secondary" className="font-normal">
                                  {indication}
                                </Badge>
                              ))
                            )}
                          </div>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-1"
                        align="start"
                      >
                        <div className="max-h-72 overflow-y-auto">
                          {INDICATION_OPTIONS.map((indication) => {
                            const isActive = selected.includes(indication)
                            return (
                              <label
                                key={indication}
                                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                              >
                                <Checkbox
                                  checked={isActive}
                                  onCheckedChange={() => toggleIndication(indication)}
                                />
                                <span>{indication}</span>
                              </label>
                            )
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="patient-has-amputations"
                  checked={showAmputations}
                  onCheckedChange={(checked) => {
                    const isChecked = checked === true
                    setShowAmputations(isChecked)
                    if (!isChecked) {
                      form.setValue("amputations", [], { shouldDirty: true })
                    }
                  }}
                />
                <div className="space-y-1 leading-none">
                  <FormLabel htmlFor="patient-has-amputations">Patient hat Amputationen</FormLabel>
                  <FormDescription>
                    Optional: korrigiert BMI-Berechnungen bei fehlenden Extremitäten.
                  </FormDescription>
                </div>
              </div>
              {showAmputations && (
                <FormField
                  control={form.control}
                  name="amputations"
                  render={() => {
                    const selected = form.watch("amputations") ?? []
                    return (
                      <FormItem>
                        <FormLabel>Betroffene Bereiche</FormLabel>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {AMPUTATION_AREAS.map((area) => {
                            const isActive = selected.includes(area.id)
                            return (
                              <Button
                                key={area.id}
                                type="button"
                                size="sm"
                                variant={isActive ? "secondary" : "outline"}
                                onClick={() => {
                                  const current = new Set(form.getValues("amputations"))
                                  if (current.has(area.id)) {
                                    current.delete(area.id)
                                  } else {
                                    current.add(area.id)
                                  }
                                  form.setValue("amputations", Array.from(current), { shouldDirty: true })
                                }}
                              >
                                {area.label}
                              </Button>
                            )
                          })}
                        </div>
                      </FormItem>
                    )
                  }}
                />
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="referrerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zuweiser</FormLabel>
                    <FormControl>
                      <Input placeholder="Arzt, Station oder Praxis" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fachbereich / Station</FormLabel>
                    <FormControl>
                      <Input placeholder="z. B. Onkologie, Station 3B" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="intakeReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aufnahmegrund</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Warum wird der Patient ernährungstherapeutisch aufgenommen?"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="patientGoals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patientenziele</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ziele, Erwartungen oder relevante Angaben aus Patientensicht"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="clinicalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Klinische Notizen</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Interne klinische Hinweise, Risiken oder Kontext"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Administrative Notizen</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Abrechnung, Terminierung, interne Organisation"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          {isEditing ? (
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Speichert..." : "Patient aktualisieren"}
            </Button>
          ) : (
            <>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                onClick={() => setSubmitIntent("detail")}
              >
                {form.formState.isSubmitting && submitIntent === "detail" ? "Erstellt..." : "Speichern & Akte öffnen"}
              </Button>
              <Button
                type="submit"
                variant="secondary"
                disabled={form.formState.isSubmitting}
                onClick={() => setSubmitIntent("counseling")}
              >
                {form.formState.isSubmitting && submitIntent === "counseling" ? "Erstellt..." : "Speichern & Erstberatung"}
              </Button>
              <Button
                type="submit"
                variant="outline"
                disabled={form.formState.isSubmitting}
                onClick={() => setSubmitIntent("overview")}
              >
                {form.formState.isSubmitting && submitIntent === "overview" ? "Erstellt..." : "Speichern & Liste"}
              </Button>
            </>
          )}
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Abbrechen
          </Button>
        </div>
      </form>
    </Form>
  )
}
