"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Crown, CreditCard, Layers3, Minus, Receipt, Shield, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  PRODUCT_TIERS,
  TIER_COMPARISON,
  ADDON_PLANS,
  BILLING_SUMMARY,
  INVOICE_HISTORY,
  USAGE_METRICS,
  PROCUREMENT_SECURITY_ITEMS,
  MIGRATION_ONBOARDING_STEPS,
  DEMO_WORKSPACE_SETUP,
  CLINIC_BUYER_CHECKLIST,
} from "@/lib/content/billing-preview"
import type { TierComparisonRow } from "@/lib/types"

const COMPARISON_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  voll: CheckCircle2,
  teil: Minus,
  "-": Minus,
}

const STATUS_COLORS: Record<string, string> = {
  bezahlt: "text-emerald-600",
  offen: "text-amber-600",
  fehlgeschlagen: "text-destructive",
}

const BILLING_STATUS_BADGE: Record<string, string> = {
  aktiv: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  überfällig: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  pausiert: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
}

export default function TarifePage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual")
  const [selectedTier, setSelectedTier] = useState("expert")

  const currentTier = PRODUCT_TIERS.find((tier) => tier.id === selectedTier) ?? PRODUCT_TIERS[0]

  const priceLabel = useMemo(() => {
    if (currentTier.priceMonthly === 0) return "Kostenlos"
    const price = billingCycle === "monthly" ? currentTier.priceMonthly : currentTier.priceAnnual
    const suffix = billingCycle === "monthly" ? "/Monat" : "/Jahr"
    return `${price.toLocaleString("de-DE", { minimumFractionDigits: 0 })} € ${suffix}`
  }, [billingCycle, currentTier])

  function handleTierSelect(tierId: string) {
    setSelectedTier(tierId)
    const tier = PRODUCT_TIERS.find((t) => t.id === tierId)
    toast.info(`${tier?.name ?? "Tarif"} vorgemerkt`, {
      description: "Preview-Modus: Es wurde kein Vertrag und kein Checkout gestartet.",
    })
  }

  function handleAddOn(id: string) {
    const addon = ADDON_PLANS.find((plan) => plan.id === id)
    toast.info(`${addon?.name} vorgemerkt`, {
      description: "Preview-Modus: Zusatzmodule werden noch nicht gebucht.",
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produkt-Tarife"
        description="Preview für Klinikpakete, Add-ons und Vertragsplanung"
        helpText="Diese Ansicht zeigt den geplanten Tarifkatalog. Es gibt noch keinen angebundenen Zahlungsanbieter, keinen Checkout und keine Live-Abonnementverwaltung."
      />

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Read-only Vertrags- und Billing-Preview</AlertTitle>
        <AlertDescription>
          Diese Seite ist eine Produkt- und Vertragsplanungsansicht. Tarifauswahl, Add-ons, Nutzung und Rechnungen sind nicht mit einem Zahlungsanbieter verbunden und ändern keinen Vertrag.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-wrap items-center gap-3">
            <div>
              <CardTitle className="text-base">Geplanter Referenztarif</CardTitle>
              <CardDescription>Beispiel: Expert + Plus Add-on</CardDescription>
            </div>
            <Badge className={cn("ml-auto", BILLING_STATUS_BADGE[BILLING_SUMMARY.status])}>{BILLING_SUMMARY.status}</Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Zahlweise</p>
              <p className="font-semibold capitalize">{billingCycle === "monthly" ? "monatlich" : "jährlich"} geplant</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nächste Rechnung</p>
              <p className="font-semibold">{BILLING_SUMMARY.nextInvoice}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Betrag</p>
              <p className="font-semibold">{BILLING_SUMMARY.amount}</p>
            </div>
            <div className="ml-auto">
              <p className="text-sm text-muted-foreground">Zahlmethode</p>
              <p className="font-semibold">{BILLING_SUMMARY.paymentMethod}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Abrechnung</CardTitle>
            <CardDescription>Geplanten Zahlzyklus vergleichen</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Jährliche Abrechnung</Label>
              <p className="text-sm">Preview-Kalkulation</p>
            </div>
            <Switch checked={billingCycle === "annual"} onCheckedChange={(checked) => setBillingCycle(checked ? "annual" : "monthly")} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Beschaffungs- und Sicherheitsunterlagen
            </CardTitle>
            <CardDescription>Read-only Status für Klinik-Einkauf, Datenschutz und IT-Prüfung</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {PROCUREMENT_SECURITY_ITEMS.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{item.title}</p>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Klinik-Buyer-Checklist</CardTitle>
            <CardDescription>Pflichtpunkte vor einem belastbaren Klinikvertrag</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {CLINIC_BUYER_CHECKLIST.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Migration aus PRODI/EBIS</CardTitle>
            <CardDescription>Onboarding-Plan für Rezepte, Patienten, Protokolle und Speisepläne</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {MIGRATION_ONBOARDING_STEPS.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-lg border p-3 text-sm">
                <Badge variant="secondary" className="mt-0.5 h-6 w-6 justify-center p-0">{index + 1}</Badge>
                <p>{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geführter Demo-Workspace</CardTitle>
            <CardDescription>Realistische, aber klar gekennzeichnete Demo-Daten für Klinikgespräche</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {DEMO_WORKSPACE_SETUP.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-lg border p-3 text-sm">
                <Badge variant="secondary" className="mt-0.5 h-6 w-6 justify-center p-0">{index + 1}</Badge>
                <p>{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {PRODUCT_TIERS.map((tier) => {
          const isSelected = tier.id === currentTier.id
          const price = tier.priceMonthly === 0
            ? "Kostenlos"
            : billingCycle === "monthly"
              ? `${tier.priceMonthly.toLocaleString("de-DE")} € / Monat`
              : `${tier.priceAnnual.toLocaleString("de-DE")} € / Jahr`

          return (
            <Card key={tier.id} className={cn("relative flex flex-col", isSelected && "border-primary shadow-lg")}
            >
              {tier.badge && (
                <Badge className="absolute right-3 top-3 bg-primary text-primary-foreground text-xs">
                  {tier.badge}
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {tier.id === "institution" ? <Layers3 className="h-4 w-4" /> : tier.id === "expert" ? <Crown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  {tier.name}
                </CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div>
                  <p className="text-2xl font-semibold">{price}</p>
                  <p className="text-sm text-muted-foreground">{tier.bestFor}</p>
                </div>
                <ul className="space-y-2 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  {tier.limits.map((limit) => (
                    <div key={limit.label} className="flex justify-between">
                      <span>{limit.label}</span>
                      <span className="font-semibold text-foreground">{limit.value}</span>
                    </div>
                  ))}
                </div>
                <Button className="mt-auto" variant={isSelected ? "default" : "outline"} onClick={() => handleTierSelect(tier.id)}>
                  {tier.cta}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Nutzung & Limits
          </CardTitle>
          <CardDescription>Geplante Planlimits, keine Live-Nutzungsdaten</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {USAGE_METRICS.map((metric) => (
            <div key={metric.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{metric.label}</span>
                <span className="text-xs text-muted-foreground">{metric.unit}</span>
              </div>
              <div className="text-2xl font-bold">{metric.used}</div>
              <Progress value={metric.limit > 0 ? (metric.used / metric.limit) * 100 : 0} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="h-5 w-5 text-muted-foreground" />
            Feature-Matrix
          </CardTitle>
          <CardDescription>Alle Tarife im direkten Vergleich</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                {PRODUCT_TIERS.map((tier) => (
                  <TableHead key={tier.id}>{tier.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {TIER_COMPARISON.map((row) => (
                <ComparisonRow key={row.id} row={row} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              Vertrags- und Rechnungsstatus
            </CardTitle>
            <CardDescription>Platzhalter bis ein Billing-Backend angebunden ist</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Tarif</TableHead>
                  <TableHead>Betrag</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {INVOICE_HISTORY.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.date}</TableCell>
                    <TableCell>{invoice.tier}</TableCell>
                    <TableCell>{invoice.amount}</TableCell>
                    <TableCell className={cn("font-medium capitalize", STATUS_COLORS[invoice.status])}>{invoice.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              Add-ons
            </CardTitle>
            <CardDescription>Optionen für Angebots- und Vertragsplanung</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ADDON_PLANS.map((addon) => (
              <div key={addon.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{addon.name}</p>
                    <p className="text-xs text-muted-foreground">{addon.description}</p>
                    {addon.includedIn && addon.includedIn.includes(selectedTier) && (
                      <Badge className="mt-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">Im Tarif inklusive</Badge>
                    )}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{addon.price}</span>
                </div>
                <Button className="mt-3 w-full" variant="outline" size="sm" onClick={() => handleAddOn(addon.id)}>
                  Vormerken
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vorgemerkter Plan</CardTitle>
          <CardDescription>Preview-Auswahl für Angebotsgespräche</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Ausgewählter Tarif</p>
            <p className="text-xl font-semibold">{currentTier.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Preis</p>
            <p className="text-xl font-semibold">{priceLabel}</p>
          </div>
          <Button
            className="ml-auto"
            onClick={() => toast.info("Anfrage vorgemerkt", { description: "Preview-Modus: Es wurde keine Vertragsänderung gespeichert." })}
          >
            Anfrage vormerken
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function ComparisonRow({ row }: { row: TierComparisonRow }) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{row.label}</div>
        {row.helper && <div className="text-xs text-muted-foreground">{row.helper}</div>}
      </TableCell>
      {PRODUCT_TIERS.map((tier) => {
        const value = row.tiers[tier.id] ?? "-"
        const Icon = COMPARISON_ICONS[value]
        const color = value === "voll" ? "text-emerald-500" : value === "teil" ? "text-amber-500" : "text-muted-foreground"
        return (
          <TableCell key={`${row.id}-${tier.id}`} className="text-center">
            {Icon ? <Icon className={cn("mx-auto h-4 w-4", color)} /> : value}
          </TableCell>
        )
      })}
    </TableRow>
  )
}
