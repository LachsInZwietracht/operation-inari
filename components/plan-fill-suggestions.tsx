"use client"

import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { OptimizationSuggestion } from "@/hooks/use-plan-analysis"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { formatNutrient } from "@/lib/format"

interface PlanFillSuggestionsProps {
  suggestions: OptimizationSuggestion[]
  onApplySuggestion: (suggestion: OptimizationSuggestion) => void
  isLocked?: boolean
}

/** Optimizer card: quick "fill open targets" picks for the active day. */
export function PlanFillSuggestions({
  suggestions,
  onApplySuggestion,
  isLocked,
}: PlanFillSuggestionsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="text-primary h-4 w-4" />
          Vorschläge zum Auffüllen
        </CardTitle>
        <CardDescription>
          {suggestions.length > 0
            ? "Schließt offene Ziele automatisch"
            : "Alle Zielwerte im Bereich – keine Vorschläge nötig."}
        </CardDescription>
      </CardHeader>
      {suggestions.length > 0 && (
        <CardContent className="space-y-2 text-sm">
          {suggestions.slice(0, 3).map((suggestion) => (
            <div
              key={suggestion.id}
              className="hover:bg-muted/40 flex items-start justify-between gap-3 rounded-md border p-2.5 transition"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{suggestion.name}</p>
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                  {MEAL_SLOT_LABELS[suggestion.slotType]} · {suggestion.targetLabel} +
                  {formatNutrient(suggestion.contribution, suggestion.unit)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0"
                disabled={isLocked}
                onClick={() => onApplySuggestion(suggestion)}
              >
                Übernehmen
              </Button>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}
