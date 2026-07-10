"use client"

import { useState } from "react"
import { Target } from "lucide-react"

import { PlanNutrientGapDialog } from "@/components/plan-nutrient-gap-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { DietLineComplianceItem } from "@/lib/meal-plan-calc"
import type {
  DailyMealPlan,
  Food,
  MealSlotType,
  PatientAllergenEntry,
} from "@/lib/types"

interface PlanNutrientGapToolProps {
  dietLineCompliance: DietLineComplianceItem[]
  micronutrientCompliance: DietLineComplianceItem[]
  patientAllergens: PatientAllergenEntry[]
  plan: DailyMealPlan
  isLocked: boolean
  onAddFood: (payload: { food: Food; grams: number; slotType: MealSlotType }) => void
}

/**
 * Tool card for the meal planner: enter a nutrient plus the amount still
 * missing today (e.g. "400 mg Calcium") and get concrete foods — with the
 * portion size that closes exactly that gap — ready to drop into a meal slot.
 */
export function PlanNutrientGapTool(props: PlanNutrientGapToolProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="focus-visible:ring-ring/50 group w-full rounded-xl text-left focus-visible:ring-2 focus-visible:outline-none"
        >
          <Card className="group-hover:border-primary/40 h-full transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="text-primary h-4 w-4" />
                Nährstoff-Lückenfüller
              </CardTitle>
              <CardDescription>
                Fehlmenge eines Nährstoffs eingeben und passende Lebensmittel finden, die genau
                diese Lücke füllen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-muted-foreground group-hover:text-foreground text-xs font-medium transition-colors">
                Tool öffnen →
              </span>
            </CardContent>
          </Card>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="text-primary h-5 w-5" />
            Nährstoff-Lückenfüller
          </DialogTitle>
          <DialogDescription>
            Lebensmittel finden, deren Portion eine konkrete Nährstoff-Lücke schließt — mit
            Nebenbedingungen und direkter Übernahme in den Plan.
          </DialogDescription>
        </DialogHeader>
        {open && <PlanNutrientGapDialog {...props} />}
      </DialogContent>
    </Dialog>
  )
}
