"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { AMPUTATION_AREAS, INDICATION_OPTIONS } from "@/lib/constants"
import type { Patient, Gender, EgkCardData } from "@/lib/types"
import { useEgkScanner } from "@/hooks/use-egk-scanner"

const patientSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  dateOfBirth: z.string().min(1, "Geburtsdatum ist erforderlich"),
  gender: z.enum(["m", "w", "d"] as const, { required_error: "Geschlecht ist erforderlich" }),
  email: z.string().email("Ungültige E-Mail-Adresse").or(z.literal("")),
  phone: z.string(),
  street: z.string(),
  zip: z.string(),
  city: z.string(),
  insuranceProvider: z.string(),
  insuranceNumber: z.string(),
  indication: z.string(),
  notes: z.string(),
  amputations: z.array(z.string()).default([]),
})

type PatientFormValues = z.infer<typeof patientSchema>

const GENDER_LABELS: Record<Gender, string> = {
  m: "Männlich",
  w: "Weiblich",
  d: "Divers",
}

interface PatientFormProps {
  patient?: Patient
  onSubmit: (values: Omit<Patient, "id" | "createdAt" | "updatedAt">) => void
  isEditing?: boolean
}

export function PatientForm({ patient, onSubmit, isEditing }: PatientFormProps) {
  const router = useRouter()
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
      indication: patient?.indication ?? "",
      notes: patient?.notes ?? "",
      amputations: patient?.amputations ?? [],
    },
  })

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
      toast.success("eGK-Daten übernommen")
    } catch (error) {
      toast.error((error as Error).message || "Karte konnte nicht eingelesen werden")
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

  function handleSubmit(values: PatientFormValues) {
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
      indication: values.indication || undefined,
      notes: values.notes || undefined,
      amputations: values.amputations && values.amputations.length > 0 ? values.amputations : undefined,
    })
    toast.success(isEditing ? "Patient aktualisiert!" : "Patient erstellt!")
    router.push("/patienten")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">eGK-Kartenleser</CardTitle>
              <p className="text-sm text-muted-foreground">
                Lesen Sie Stammdaten direkt von elektronischen Gesundheitskarten aus.
              </p>
            </div>
            <Badge variant={egkStatus === "ready" ? "secondary" : "outline"}>{egkStatusLabel[egkStatus]}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {!egkSupported && (
              <p className="text-sm text-muted-foreground">
                Ihr Browser unterstützt aktuell keine Web-Serial-Verbindung. Nutzen Sie die Demo-Schaltfläche oder den Companion-Connector.
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
                {isEgkConnecting ? "Verbinde..." : "Leser verbinden"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={egkStatus !== "ready" || isEgkReading}
                onClick={() => void handleEgkScan()}
              >
                {isEgkReading ? "Lese Karte..." : "Karte einlesen"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleEgkSimulation}>
                Demo-Karte nutzen
              </Button>
            </div>
            {lastCard && (
              <div className="rounded-md border bg-background p-3 text-sm">
                <p className="font-medium">
                  Zuletzt gelesen: {lastCard.firstName} {lastCard.lastName}
                </p>
                <p className="text-muted-foreground">
                  {lastCard.street}, {lastCard.zip} {lastCard.city} · {lastCard.insuranceProvider}
                </p>
              </div>
            )}
            {lastError && <p className="text-sm text-destructive">{lastError}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Persönliche Daten</CardTitle>
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

            <FormField
              control={form.control}
              name="amputations"
              render={() => {
                const selected = form.watch("amputations") ?? []
                return (
                  <FormItem>
                    <FormLabel>Amputationen</FormLabel>
                    <FormDescription>
                      Optional: korrigiert BMI-Berechnungen bei fehlenden Extremitäten.
                    </FormDescription>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adresse</CardTitle>
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
              name="indication"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Indikation</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Indikation wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INDICATION_OPTIONS.map((indication) => (
                        <SelectItem key={indication} value={indication}>
                          {indication}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notizen</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Anmerkungen zum Patienten"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit">
            {isEditing ? "Patient aktualisieren" : "Patient erstellen"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Abbrechen
          </Button>
        </div>
      </form>
    </Form>
  )
}
