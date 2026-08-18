"use client"

import { useMemo, useState } from "react"
import { Check, Minus, Pencil, Plus, RotateCcw, Target, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DIET_EXCLUSION_LABELS } from "@/lib/diet-constants"
import { formatNumber } from "@/lib/format"
import {
  applyPrincipleOverrides,
  buildPrinciples,
  isPrincipleMet,
  describeDietFrame,
  type Principle,
  type PrincipleInput,
} from "@/lib/nutrition/principles"
import type { PlanPrincipleOverrides } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PlanPrinciplesCardProps extends PrincipleInput {
  /** Nutrient totals reached on the currently selected day, by nutrient id. */
  dayTotals?: Record<string, number>
  /** Counselor edits stored on the patient. */
  overrides?: PlanPrincipleOverrides
  /** Absent on surfaces without a patient to write to, which hides editing. */
  onSaveOverrides?: (next: PlanPrincipleOverrides | undefined) => Promise<void>
}

/**
 * The strategy layer of a plan: a handful of rules the patient can follow
 * without the plan in front of them. The day below is one way to hit them —
 * swapping a food is fine as long as the rule stays green.
 *
 * Every rule is derived, so it can be traced back to the number it came from.
 * A counselor who knows better can raise a target, drop a rule or write one of
 * their own; those edits are stored as differences, not as a replacement list,
 * so the rest keeps following the record when the record changes.
 */
export function PlanPrinciplesCard({
  dayTotals,
  overrides,
  onSaveOverrides,
  ...input
}: PlanPrinciplesCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [newPrinciple, setNewPrinciple] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const derived = useMemo(
    () =>
      buildPrinciples({
        calorieGoal: input.calorieGoal,
        macroPreset: input.macroPreset,
        dietStyle: input.dietStyle,
        exclusions: input.exclusions,
        weightKg: input.weightKg,
        dietLineTargets: input.dietLineTargets,
      }),
    [
      input.calorieGoal,
      input.macroPreset,
      input.dietStyle,
      input.exclusions,
      input.weightKg,
      input.dietLineTargets,
    ],
  )

  const principles = useMemo(
    () => applyPrincipleOverrides(derived, overrides),
    [derived, overrides],
  )

  const frame = describeDietFrame(input.dietStyle, input.exclusions, DIET_EXCLUSION_LABELS)
  const hidden = derived.filter((principle) => overrides?.hidden?.includes(principle.id))
  const canEdit = Boolean(onSaveOverrides)

  if (principles.length === 0 && !isEditing) {
    return null
  }

  const save = async (next: PlanPrincipleOverrides) => {
    if (!onSaveOverrides) return
    // An empty difference is no difference: store nothing rather than an object
    // that would keep this patient pinned to today's derivation.
    const isEmpty =
      !next.hidden?.length &&
      !next.custom?.length &&
      Object.keys(next.targets ?? {}).length === 0
    setIsSaving(true)
    try {
      await onSaveOverrides(isEmpty ? undefined : next)
    } catch {
      toast.error("Prinzipien konnten nicht gespeichert werden.")
    } finally {
      setIsSaving(false)
    }
  }

  const setTarget = (id: string, value: number | undefined) => {
    const targets = { ...(overrides?.targets ?? {}) }
    if (value === undefined) delete targets[id]
    else targets[id] = value
    void save({ ...overrides, targets })
  }

  const setHidden = (id: string, isHidden: boolean) => {
    const current = new Set(overrides?.hidden ?? [])
    if (isHidden) current.add(id)
    else current.delete(id)
    void save({ ...overrides, hidden: [...current] })
  }

  const removeCustom = (id: string) => {
    void save({
      ...overrides,
      custom: (overrides?.custom ?? []).filter((entry) => entry.id !== id),
    })
  }

  const addCustom = () => {
    const text = newPrinciple.trim()
    if (!text) return
    setNewPrinciple("")
    void save({
      ...overrides,
      custom: [
        ...(overrides?.custom ?? []),
        { id: `custom-${Date.now().toString(36)}`, text },
      ],
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Prinzipien
            </CardTitle>
            <CardDescription>
              Die Strategie hinter dem Plan. Der Tag darunter ist ein Weg dorthin —
              tauschen ist erlaubt, solange die Prinzipien stehen.
            </CardDescription>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => setIsEditing((previous) => !previous)}
            >
              {isEditing ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" />
                  Fertig
                </>
              ) : (
                <>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Anpassen
                </>
              )}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {frame ? (
          <Badge variant="outline" className="mb-1">
            {frame}
          </Badge>
        ) : null}

        <ul className="space-y-2">
          {principles.map((principle) => (
            <PrincipleRow
              key={principle.id}
              principle={principle}
              actual={
                principle.metricKey !== undefined ? dayTotals?.[principle.metricKey] : undefined
              }
              isEditing={isEditing}
              isSaving={isSaving}
              isOverridden={overrides?.targets?.[principle.id] !== undefined}
              onTargetChange={(value) => setTarget(principle.id, value)}
              onHide={() =>
                principle.isCustom ? removeCustom(principle.id) : setHidden(principle.id, true)
              }
            />
          ))}
        </ul>

        {isEditing ? (
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <Input
                value={newPrinciple}
                placeholder="Eigenes Prinzip, z. B. „Zu jeder Mahlzeit Gemüse“"
                disabled={isSaving}
                onChange={(event) => setNewPrinciple(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addCustom()
                  }
                }}
                className="h-8"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving || !newPrinciple.trim()}
                onClick={addCustom}
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">Prinzip hinzufügen</span>
              </Button>
            </div>

            {hidden.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Ausgeblendet</p>
                {hidden.map((principle) => (
                  <button
                    key={principle.id}
                    type="button"
                    disabled={isSaving}
                    onClick={() => setHidden(principle.id, false)}
                    className="flex w-full items-start gap-2 rounded-md px-1 py-0.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="line-through">{principle.text}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function PrincipleRow({
  principle,
  actual,
  isEditing,
  isSaving,
  isOverridden,
  onTargetChange,
  onHide,
}: {
  principle: Principle
  actual?: number
  isEditing: boolean
  isSaving: boolean
  isOverridden: boolean
  onTargetChange: (value: number | undefined) => void
  onHide: () => void
}) {
  const met = actual !== undefined ? isPrincipleMet(principle, actual) : undefined
  const editableTarget = principle.targetValue !== undefined && !principle.isCustom

  const [draft, setDraft] = useState(String(principle.targetValue ?? ""))
  const [lastTarget, setLastTarget] = useState(principle.targetValue)
  if (principle.targetValue !== lastTarget) {
    setLastTarget(principle.targetValue)
    setDraft(String(principle.targetValue ?? ""))
  }

  const commit = () => {
    const parsed = Number(draft.replace(",", "."))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDraft(String(principle.targetValue ?? ""))
      return
    }
    const rounded = Math.round(parsed)
    if (rounded === principle.targetValue) return
    onTargetChange(rounded)
  }

  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        className={cn(
          "mt-0.5",
          met === undefined
            ? "text-muted-foreground"
            : met
              ? "text-emerald-600 dark:text-emerald-500"
              : "text-amber-600 dark:text-amber-500",
        )}
      >
        {met === undefined ? (
          <Minus className="h-4 w-4" />
        ) : met ? (
          <Check className="h-4 w-4" />
        ) : (
          <Target className="h-4 w-4" />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">
              {principle.text}
              {actual !== undefined && principle.unit ? (
                <span className="ml-1 text-muted-foreground">
                  (aktuell {formatNumber(Math.round(actual))} {principle.unit})
                </span>
              ) : null}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Quelle: {principle.source}</p>
          </TooltipContent>
        </Tooltip>

        {isEditing && editableTarget ? (
          <span className="flex items-center gap-1">
            <Input
              type="number"
              inputMode="numeric"
              value={draft}
              disabled={isSaving}
              aria-label={`Zielwert für ${principle.text}`}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur()
              }}
              className="h-7 w-20 px-2 tabular-nums"
            />
            <span className="text-xs text-muted-foreground">{principle.unit}</span>
            {isOverridden ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => onTargetChange(undefined)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Zielwert zurücksetzen"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </span>
        ) : null}
      </div>

      {isEditing ? (
        <button
          type="button"
          disabled={isSaving}
          onClick={onHide}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`${principle.text} entfernen`}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </li>
  )
}
