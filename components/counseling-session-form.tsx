"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { FileText } from "lucide-react"
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
import { CounselingTemplatePicker } from "@/components/counseling-template-picker"

import { INDICATION_OPTIONS, COUNSELING_DURATION_OPTIONS } from "@/lib/constants"
import { typedZodResolver } from "@/lib/forms"
import type { CounselingSession } from "@/lib/types"

const sessionSchema = z.object({
  date: z.string().min(1, "Datum ist erforderlich"),
  duration: z.coerce.number().min(1, "Dauer ist erforderlich"),
  type: z.string().min(1, "Beratungsart ist erforderlich"),
  indication: z.string().min(1, "Indikation ist erforderlich"),
  goals: z.string(),
  content: z.string().min(1, "Dokumentation ist erforderlich"),
  recommendations: z.string(),
  nextAppointment: z.string(),
})

type SessionFormValues = z.infer<typeof sessionSchema>

interface CounselingSessionFormProps {
  patientId: string
  defaultIndication?: string
  onSubmit: (
    session: Omit<CounselingSession, "id" | "createdAt" | "updatedAt">,
  ) => Promise<CounselingSession> | CounselingSession
}

const SESSION_TYPES = ["Erstberatung", "Folgeberatung", "Telefonberatung", "Gruppenberatung"]

export function CounselingSessionForm({
  patientId,
  defaultIndication,
  onSubmit,
}: CounselingSessionFormProps) {
  const router = useRouter()
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)

  const form = useForm<SessionFormValues>({
    resolver: typedZodResolver(sessionSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      duration: 45,
      type: "Erstberatung",
      indication: defaultIndication ?? "",
      goals: "",
      content: "",
      recommendations: "",
      nextAppointment: "",
    },
  })

  function handleTemplateSelect(content: string) {
    const currentContent = form.getValues("content")
    form.setValue("content", currentContent ? `${currentContent}\n\n${content}` : content)
  }

  async function handleSubmit(values: SessionFormValues) {
    const createdSession = await onSubmit({
      patientId,
      date: values.date,
      duration: values.duration,
      type: values.type,
      indication: values.indication,
      goals: values.goals || undefined,
      content: values.content,
      recommendations: values.recommendations || undefined,
      nextAppointment: values.nextAppointment || undefined,
    })

    toast.success("Beratungssitzung erstellt!")
    router.push(`/patienten/${patientId}/beratungen/${createdSession.id}`)
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sitzungsdaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Datum</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dauer (Min.)</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(Number(val))}
                        value={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COUNSELING_DURATION_OPTIONS.map((dur) => (
                            <SelectItem key={dur} value={String(dur)}>
                              {dur} Minuten
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
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beratungsart</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SESSION_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        {INDICATION_OPTIONS.map((ind) => (
                          <SelectItem key={ind} value={ind}>
                            {ind}
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
                name="goals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beratungsziele</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Ziele für diese Sitzung" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Dokumentation</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTemplatePickerOpen(true)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Vorlage einfügen
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Beratungsdokumentation..."
                        rows={16}
                        className="font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Empfehlungen & Ausblick</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="recommendations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empfehlungen</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Empfehlungen für den Patienten"
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
                name="nextAppointment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nächster Termin</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit">Beratung speichern</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Abbrechen
            </Button>
          </div>
        </form>
      </Form>

      <CounselingTemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={handleTemplateSelect}
      />
    </>
  )
}
