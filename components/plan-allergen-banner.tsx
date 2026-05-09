"use client"

import { ShieldAlert, AlertTriangle, Info } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  ALLERGEN_SEVERITY_LABELS,
  ALLERGEN_TYPE_LABELS,
  type AllergenSeverity,
} from "@/lib/allergen-constants"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import type { PlanAllergenSummary } from "@/lib/allergen-warnings"
import { cn } from "@/lib/utils"

interface PlanAllergenBannerProps {
  summary: PlanAllergenSummary
  onResolve?: () => void
}

const SEVERITY_THEME: Record<
  AllergenSeverity,
  { container: string; title: string; meta: string; icon: typeof ShieldAlert }
> = {
  severe: {
    container:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-100",
    title: "text-red-900 dark:text-red-50",
    meta: "text-red-800/80 dark:text-red-200/80",
    icon: ShieldAlert,
  },
  moderate: {
    container:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100",
    title: "text-amber-900 dark:text-amber-50",
    meta: "text-amber-800/80 dark:text-amber-200/80",
    icon: AlertTriangle,
  },
  mild: {
    container:
      "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-500/40 dark:bg-yellow-950/30 dark:text-yellow-100",
    title: "text-yellow-900 dark:text-yellow-50",
    meta: "text-yellow-800/80 dark:text-yellow-200/80",
    icon: Info,
  },
}

const SEVERITY_BADGE: Record<AllergenSeverity, string> = {
  severe: "border-red-300 bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-100",
  moderate:
    "border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100",
  mild:
    "border-yellow-300 bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-100",
}

export function PlanAllergenBanner({ summary, onResolve }: PlanAllergenBannerProps) {
  if (summary.totalConflicts === 0 || !summary.highestSeverity) return null

  const theme = SEVERITY_THEME[summary.highestSeverity]
  const Icon = theme.icon
  const affectedEntries = summary.affectedEntryIds.size
  const headlineSeverity = ALLERGEN_SEVERITY_LABELS[summary.highestSeverity].toLowerCase()

  const headline =
    summary.highestSeverity === "severe"
      ? "Schwere Allergenkonflikte im Tagesplan"
      : summary.highestSeverity === "moderate"
        ? "Mittlere Allergenkonflikte im Tagesplan"
        : "Leichte Allergenhinweise im Tagesplan"

  return (
    <Card
      className={cn(
        "border-l-4 shadow-sm",
        theme.container,
      )}
      role="alert"
      aria-live={summary.highestSeverity === "severe" ? "assertive" : "polite"}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <p className={cn("text-sm font-semibold", theme.title)}>{headline}</p>
            <p className={cn("text-xs", theme.meta)}>
              {affectedEntries} {affectedEntries === 1 ? "Eintrag" : "Einträge"} kollidieren mit{" "}
              {summary.byAllergen.length}{" "}
              {summary.byAllergen.length === 1
                ? "hinterlegtem Allergen-/Intoleranzhinweis"
                : "hinterlegten Allergen-/Intoleranzhinweisen"}
              . Höchste Schwere: {headlineSeverity}.
            </p>
          </div>
          <ul className="space-y-1.5">
            {summary.byAllergen.map((aggregate) => {
              const slotLabels = Array.from(aggregate.slotTypes)
                .map((slotType) => MEAL_SLOT_LABELS[slotType] ?? slotType)
                .join(", ")
              return (
                <li
                  key={aggregate.allergenId}
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  <Badge
                    variant="outline"
                    className={cn("uppercase tracking-wide", SEVERITY_BADGE[aggregate.severity])}
                  >
                    {ALLERGEN_SEVERITY_LABELS[aggregate.severity]}
                  </Badge>
                  <span className="font-medium">{aggregate.allergenLabel}</span>
                  <span className={theme.meta}>
                    {ALLERGEN_TYPE_LABELS[aggregate.type]} · {aggregate.entryIds.size}{" "}
                    {aggregate.entryIds.size === 1 ? "Eintrag" : "Einträge"} ({slotLabels})
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
        {onResolve && (
          <Button
            variant="outline"
            size="sm"
            onClick={onResolve}
            className="self-start whitespace-nowrap"
          >
            Konflikte beheben
          </Button>
        )}
      </div>
    </Card>
  )
}
