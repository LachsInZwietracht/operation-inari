"use client"

import { useMemo, useState } from "react"
import { Building2, CheckCircle2, Stethoscope, UsersRound } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type BillingCycle = "monthly" | "annual"

type PricingPlan = {
  id: string
  name: string
  description: string
  priceMonthly: number
  priceAnnual: number
  badge?: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  features: string[]
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: "praxis",
    name: "Praxis",
    description: "Für Einzelpraxen und kleine Beratungsteams.",
    priceMonthly: 49,
    priceAnnual: 490,
    icon: Stethoscope,
    features: ["Lebensmittel, Rezepte und Pläne", "Patientenakten und Protokolle", "PDF- und Tabellenexporte"],
  },
  {
    id: "team",
    name: "Team",
    description: "Für Praxen mit mehreren Rollen und mehr Dokumentation.",
    priceMonthly: 129,
    priceAnnual: 1290,
    badge: "Beliebt",
    icon: UsersRound,
    features: ["Alles aus Praxis", "Mehrbenutzer und Rollen", "Laborwerte, Reports und Verlauf"],
  },
  {
    id: "klinik",
    name: "Klinik",
    description: "Für klinische Ernährung, Stationen und Küchenprozesse.",
    priceMonthly: 349,
    priceAnnual: 3490,
    icon: Building2,
    features: ["Alles aus Team", "Menüzyklen und Stationsabläufe", "Compliance- und Küchenübersichten"],
  },
]

export default function TarifePage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual")
  const [selectedPlanId, setSelectedPlanId] = useState("team")

  const selectedPlan = PRICING_PLANS.find((plan) => plan.id === selectedPlanId) ?? PRICING_PLANS[0]

  const selectedPrice = useMemo(
    () => formatPrice(selectedPlan, billingCycle),
    [billingCycle, selectedPlan]
  )

  function handlePlanSelect(plan: PricingPlan) {
    setSelectedPlanId(plan.id)
    toast.info(`${plan.name} ausgewählt`, {
      description: "Preview-Modus: Es wurde keine Vertragsänderung gespeichert.",
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarife"
        description="Drei einfache Pläne für Praxis, Team und Klinik."
        helpText="Diese Ansicht ist eine Preview. Die Auswahl startet noch keinen Checkout und ändert keinen Vertrag."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Abrechnung</p>
          <p className="text-sm text-muted-foreground">Monatlich flexibel oder jährlich mit Preisvorteil.</p>
        </div>
        <Tabs value={billingCycle} onValueChange={(value) => setBillingCycle(value as BillingCycle)}>
          <TabsList className="grid w-full grid-cols-2 sm:w-[280px]">
            <TabsTrigger value="monthly">Monatlich</TabsTrigger>
            <TabsTrigger value="annual">Jährlich</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PRICING_PLANS.map((plan) => {
          const Icon = plan.icon
          const isSelected = plan.id === selectedPlanId

          return (
            <Card key={plan.id} className={cn("relative flex min-h-[420px] flex-col", isSelected && "border-primary shadow-lg")}>
              {plan.badge && (
                <Badge className="absolute right-4 top-4 bg-primary text-primary-foreground">
                  {plan.badge}
                </Badge>
              )}
              <CardHeader className="space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-6">
                <div>
                  <p className="text-3xl font-semibold tracking-normal">{formatPrice(plan, billingCycle)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {billingCycle === "annual" ? "jährlich abgerechnet" : "monatlich abgerechnet"}
                  </p>
                </div>

                <ul className="space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button className="mt-auto" variant={isSelected ? "default" : "outline"} onClick={() => handlePlanSelect(plan)}>
                  {isSelected ? "Ausgewählt" : "Plan auswählen"}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Aktuelle Auswahl</p>
            <p className="text-xl font-semibold">
              {selectedPlan.name} · {selectedPrice}
            </p>
          </div>
          <Button
            onClick={() =>
              toast.info("Anfrage vorgemerkt", {
                description: `${selectedPlan.name} mit ${billingCycle === "annual" ? "jährlicher" : "monatlicher"} Abrechnung.`,
              })
            }
          >
            Anfrage vorbereiten
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function formatPrice(plan: PricingPlan, billingCycle: BillingCycle) {
  const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual
  const suffix = billingCycle === "monthly" ? "Monat" : "Jahr"

  return `${price.toLocaleString("de-DE")} € / ${suffix}`
}
