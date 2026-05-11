"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Building2, UserPlus, Lightbulb, UtensilsCrossed, FileText, CalendarDays } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOnboarding } from "@/hooks/use-onboarding"
import { usePracticeInfo } from "@/hooks/use-practice-info"
import { usePatients } from "@/hooks/use-patients"
import { INDICATION_OPTIONS } from "@/lib/constants"
import type { Gender } from "@/lib/types"

const practiceSchema = z.object({
  name: z.string().min(1, "Praxisname ist erforderlich"),
  address: z.string(),
  phone: z.string(),
  email: z.string().email("Ungültige E-Mail").or(z.literal("")),
})

type PracticeFormData = z.infer<typeof practiceSchema>

const patientSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  dateOfBirth: z.string().min(1, "Geburtsdatum ist erforderlich"),
  gender: z.enum(["m", "w", "d"]),
  indications: z.array(z.string()),
})

type PatientFormData = z.infer<typeof patientSchema>

const TIPS = [
  {
    icon: UtensilsCrossed,
    title: "Ernährungspläne erstellen",
    description:
      "Nutzen Sie die Lebensmittel-Datenbank und den Rezept-Editor, um individuelle Ernährungspläne für Ihre Patienten zu erstellen.",
  },
  {
    icon: FileText,
    title: "Berichte generieren",
    description:
      "Erstellen Sie professionelle PDF-Berichte mit Nährstoffanalysen, Textvorlagen und Platzhaltern — direkt aus dem Ernährungsplan.",
  },
  {
    icon: CalendarDays,
    title: "Praxis verwalten",
    description:
      "Termine, Rechnungen und Serienbriefe — alles an einem Ort. Verwalten Sie Ihre Praxis effizient und behalten Sie den Überblick.",
  },
]

export function OnboardingWizard() {
  const { showOnboarding, completeOnboarding, skipOnboarding } = useOnboarding()
  const { setPracticeInfo } = usePracticeInfo()
  const { addPatient } = usePatients()
  const [step, setStep] = useState<0 | 1 | 2>(0)

  const practiceForm = useForm<PracticeFormData>({
    resolver: zodResolver(practiceSchema),
    defaultValues: { name: "", address: "", phone: "", email: "" },
  })

  const patientForm = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: { firstName: "", lastName: "", dateOfBirth: "", gender: "w", indications: [] },
  })

  if (!showOnboarding) return null

  function handlePracticeSubmit(data: PracticeFormData) {
    setPracticeInfo({
      name: data.name,
      address: data.address ?? "",
      phone: data.phone ?? "",
      email: data.email || undefined,
    })
    setStep(1)
  }

  async function handlePatientSubmit(data: PatientFormData) {
    await addPatient({
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender as Gender,
      indications: data.indications.length > 0 ? data.indications : undefined,
    })
    setStep(2)
  }

  function handleComplete() {
    completeOnboarding()
  }

  function handleSkipStep() {
    if (step < 2) {
      setStep((step + 1) as 0 | 1 | 2)
    } else {
      completeOnboarding()
    }
  }

  return (
    <Dialog open onOpenChange={() => skipOnboarding()}>
      <DialogContent className="sm:max-w-lg" data-testid="onboarding-wizard">
        <DialogHeader>
          <DialogTitle>
            {step === 0 && "Willkommen bei Inari"}
            {step === 1 && "Ersten Patienten anlegen"}
            {step === 2 && "Schnelltipps"}
          </DialogTitle>
          <DialogDescription>
            {step === 0 && "Richten Sie Ihre Praxis ein, um direkt loszulegen."}
            {step === 1 && "Legen Sie optional Ihren ersten Patienten an."}
            {step === 2 && "So holen Sie das Beste aus Inari heraus."}
          </DialogDescription>
        </DialogHeader>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 py-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {/* Step 0 — Practice Info */}
        {step === 0 && (
          <form onSubmit={practiceForm.handleSubmit(handlePracticeSubmit)} className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-5 w-5" />
              <span className="text-sm font-medium">Praxis-Informationen</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="practice-name">Praxisname *</Label>
                <Input
                  id="practice-name"
                  placeholder="z. B. Praxis für Ernährungsberatung"
                  {...practiceForm.register("name")}
                />
                {practiceForm.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {practiceForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="practice-address">Adresse</Label>
                <Input
                  id="practice-address"
                  placeholder="Straße, PLZ Ort"
                  {...practiceForm.register("address")}
                />
              </div>
              <div>
                <Label htmlFor="practice-phone">Telefon</Label>
                <Input
                  id="practice-phone"
                  placeholder="+49 ..."
                  {...practiceForm.register("phone")}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="practice-email">E-Mail (optional)</Label>
                <Input
                  id="practice-email"
                  type="email"
                  placeholder="praxis@beispiel.de"
                  {...practiceForm.register("email")}
                />
                {practiceForm.formState.errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {practiceForm.formState.errors.email.message}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="link" size="sm" onClick={handleSkipStep}>
                Überspringen
              </Button>
              <Button type="submit">Weiter</Button>
            </div>
          </form>
        )}

        {/* Step 1 — First Patient */}
        {step === 1 && (
          <form onSubmit={patientForm.handleSubmit(handlePatientSubmit)} className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserPlus className="h-5 w-5" />
              <span className="text-sm font-medium">Patient anlegen</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="patient-firstName">Vorname *</Label>
                <Input
                  id="patient-firstName"
                  placeholder="Vorname"
                  {...patientForm.register("firstName")}
                />
                {patientForm.formState.errors.firstName && (
                  <p className="text-sm text-destructive mt-1">
                    {patientForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="patient-lastName">Nachname *</Label>
                <Input
                  id="patient-lastName"
                  placeholder="Nachname"
                  {...patientForm.register("lastName")}
                />
                {patientForm.formState.errors.lastName && (
                  <p className="text-sm text-destructive mt-1">
                    {patientForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="patient-dob">Geburtsdatum *</Label>
                <Input
                  id="patient-dob"
                  type="date"
                  {...patientForm.register("dateOfBirth")}
                />
                {patientForm.formState.errors.dateOfBirth && (
                  <p className="text-sm text-destructive mt-1">
                    {patientForm.formState.errors.dateOfBirth.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="patient-gender">Geschlecht *</Label>
                <Select
                  value={patientForm.watch("gender")}
                  onValueChange={(val) => patientForm.setValue("gender", val as "m" | "w" | "d")}
                >
                  <SelectTrigger id="patient-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="w">Weiblich</SelectItem>
                    <SelectItem value="m">Männlich</SelectItem>
                    <SelectItem value="d">Divers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Indikationen</Label>
                <p className="text-muted-foreground text-xs">
                  Optional, Mehrfachauswahl möglich.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {INDICATION_OPTIONS.map((opt) => {
                    const selected = patientForm.watch("indications") ?? []
                    const isActive = selected.includes(opt)
                    return (
                      <Button
                        key={opt}
                        type="button"
                        size="sm"
                        variant={isActive ? "secondary" : "outline"}
                        onClick={() => {
                          const current = new Set(patientForm.getValues("indications"))
                          if (current.has(opt)) {
                            current.delete(opt)
                          } else {
                            current.add(opt)
                          }
                          patientForm.setValue("indications", Array.from(current), {
                            shouldDirty: true,
                          })
                        }}
                      >
                        {opt}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="link" size="sm" onClick={handleSkipStep}>
                Überspringen
              </Button>
              <Button type="submit">Patient anlegen & weiter</Button>
            </div>
          </form>
        )}

        {/* Step 2 — Quick Tips */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lightbulb className="h-5 w-5" />
              <span className="text-sm font-medium">Loslegen</span>
            </div>
            <div className="space-y-3">
              {TIPS.map((tip) => (
                <div key={tip.title} className="flex gap-3 rounded-lg border p-3">
                  <tip.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-sm">{tip.title}</p>
                    <p className="text-xs text-muted-foreground">{tip.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="link" size="sm" onClick={handleSkipStep}>
                Überspringen
              </Button>
              <Button onClick={handleComplete}>Fertig</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
