"use client"

import { useRouter } from "next/navigation"
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { INDICATION_OPTIONS } from "@/lib/constants"
import type { Patient, Gender } from "@/lib/types"

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
    },
  })

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
    })
    toast.success(isEditing ? "Patient aktualisiert!" : "Patient erstellt!")
    router.push("/patienten")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
