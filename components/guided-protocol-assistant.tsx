"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, ArrowRight, Timer, StickyNote, Utensils } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"

import { PROTOCOL_TEMPLATES } from "@/lib/protocol-templates"
import { ASSESSMENT_METHOD_LABELS, HOUSEHOLD_PRESETS } from "@/lib/constants"

interface GuidedProtocolAssistantProps {
  patientId: string
}

export function GuidedProtocolAssistant({ patientId }: GuidedProtocolAssistantProps) {
  const router = useRouter()
  const [activeTemplateId, setActiveTemplateId] = useState(PROTOCOL_TEMPLATES[0]?.id)
  const [stepCompletion, setStepCompletion] = useState<Record<string, number[]>>({})

  const activeTemplate = useMemo(() => {
    return (
      PROTOCOL_TEMPLATES.find((template) => template.id === activeTemplateId) ||
      PROTOCOL_TEMPLATES[0]
    )
  }, [activeTemplateId])

  const completedSteps = activeTemplate
    ? stepCompletion[activeTemplate.id] ?? []
    : []

  const quickAddLabels = useMemo(() => {
    if (!activeTemplate?.quickAddPresetIds?.length) return []
    return HOUSEHOLD_PRESETS.filter((preset) =>
      activeTemplate.quickAddPresetIds?.includes(preset.id),
    ).map((preset) => preset.label)
  }, [activeTemplate])

  function toggleStep(index: number) {
    if (!activeTemplate) return
    setStepCompletion((prev) => {
      const existing = prev[activeTemplate.id] ?? []
      const updated = existing.includes(index)
        ? existing.filter((value) => value !== index)
        : [...existing, index]
      return { ...prev, [activeTemplate.id]: updated }
    })
  }

  if (!activeTemplate) return null

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Protokoll-Assistent
        </div>
        <CardTitle>Geführte Templates</CardTitle>
        <CardDescription>
          Schritt-für-Schritt-Anleitungen inkl. Freiburg-Variante und pflanzenbasierter Vorlagen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTemplate.id} onValueChange={setActiveTemplateId}>
          <TabsList className="flex w-full flex-wrap justify-start gap-2 overflow-x-auto">
            {PROTOCOL_TEMPLATES.map((template) => (
              <TabsTrigger key={template.id} value={template.id} className="px-3 text-xs">
                {template.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {PROTOCOL_TEMPLATES.map((template) => (
            <TabsContent key={template.id} value={template.id} className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">
                  {ASSESSMENT_METHOD_LABELS[template.method]}
                </Badge>
                <Badge variant="outline">
                  <Timer className="mr-1 h-3.5 w-3.5" />
                  {template.recommendedDays} Tage
                </Badge>
                {template.measurementPreset === "household" && (
                  <Badge variant="outline" className="border-dashed">
                    Haushaltsmaße aktiv
                  </Badge>
                )}
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                {template.description}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {template.steps.map((step, index) => (
                    <div key={step.title} className="rounded-lg border p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={completedSteps.includes(index)}
                          onCheckedChange={() => toggleStep(index)}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-semibold text-sm">{step.title}</p>
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                          {step.hints && (
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                              {step.hints.map((hint) => (
                                <li key={hint}>{hint}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {template.sections?.map((section) => (
                    <div key={section.title} className="rounded-lg border p-3">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <StickyNote className="h-4 w-4 text-muted-foreground" />
                        {section.title}
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                        {section.checklist.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      {section.emphasis && (
                        <p className="mt-2 text-xs text-amber-600">{section.emphasis}</p>
                      )}
                    </div>
                  ))}
                  {template.suggestedMealSlots && (
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="flex items-center gap-2 font-semibold">
                        <Utensils className="h-4 w-4 text-muted-foreground" />
                        Empfohlene Slots
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {template.suggestedMealSlots
                          .map((slot) => slot.replace("_", " "))
                          .join(" • ")}
                      </p>
                    </div>
                  )}
                  {quickAddLabels.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                      <p className="mb-1 font-semibold text-sm">Haushalts-Presets</p>
                      <ul className="space-y-1">
                        {quickAddLabels.map((label) => (
                          <li key={label}>{label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() =>
                    router.push(
                      `/patienten/${patientId}/protokolle/neu?template=${template.id}`,
                    )
                  }
                >
                  Geführte Erfassung starten
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigator.clipboard?.writeText(template.description)}
                >
                  Beschreibung kopieren
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
