"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

import {
  ALLERGEN_SEVERITY_LABELS,
  ALLERGEN_TYPE_LABELS,
} from "@/lib/allergen-constants"
import {
  checkAllergenConflicts,
  type AllergenWarning,
} from "@/lib/allergen-warnings"
import type { MealEntry, MealSlotType, PatientAllergenEntry } from "@/lib/types"

type EntryPayload = { type: MealEntry["type"]; referenceId: string; amount: number }

export interface PendingAllergenIntent {
  itemKind: "food" | "recipe"
  itemName: string
  slotType: MealSlotType
  payload: EntryPayload
  warnings: AllergenWarning[]
  replaceEntryId?: string
  /** Target plan date; defaults to the currently opened day when omitted. */
  date?: string
  followUp?: () => void
}

export interface GuardedAddContext {
  itemKind: "food" | "recipe"
  itemName: string
  allergens: string[] | undefined
  replaceEntryId?: string
  date?: string
  followUp?: () => void
}

interface UseAllergenGuardOptions {
  patientAllergens: PatientAllergenEntry[]
  addEntry: (slotType: MealSlotType, payload: EntryPayload) => void
  addEntryForDate: (date: string, slotType: MealSlotType, payload: EntryPayload) => void
  replaceEntry: (slotType: MealSlotType, entryId: string, payload: EntryPayload) => void
}

/**
 * Gates every plan mutation behind the patient's allergen profile:
 * mild/moderate conflicts pass through with a toast, severe conflicts are
 * held as a pending intent until explicitly confirmed or dismissed.
 */
export function useAllergenGuard({
  patientAllergens,
  addEntry,
  addEntryForDate,
  replaceEntry,
}: UseAllergenGuardOptions) {
  const [pendingIntent, setPendingIntent] = useState<PendingAllergenIntent | null>(null)

  const notifyAllergenWarnings = useCallback(
    (itemName: string, warnings: AllergenWarning[]) => {
      for (const warning of warnings) {
        const headline =
          warning.severity === "moderate"
            ? `Mittlerer Allergenkonflikt: ${itemName}`
            : `Allergenhinweis: ${itemName}`
        toast.warning(headline, {
          description: `${warning.allergenLabel} · ${ALLERGEN_TYPE_LABELS[warning.type]} · ${ALLERGEN_SEVERITY_LABELS[warning.severity]}`,
        })
      }
    },
    [],
  )

  const commitIntent = useCallback(
    (intent: PendingAllergenIntent) => {
      if (intent.replaceEntryId) {
        replaceEntry(intent.slotType, intent.replaceEntryId, intent.payload)
      } else if (intent.date) {
        addEntryForDate(intent.date, intent.slotType, intent.payload)
      } else {
        addEntry(intent.slotType, intent.payload)
      }
      intent.followUp?.()
    },
    [addEntry, addEntryForDate, replaceEntry],
  )

  const guardedAddEntry = useCallback(
    (slotType: MealSlotType, payload: EntryPayload, context: GuardedAddContext) => {
      const warnings =
        patientAllergens.length > 0 && context.allergens?.length
          ? checkAllergenConflicts(context.allergens, patientAllergens)
          : []
      const hasSevere = warnings.some((warning) => warning.severity === "severe")

      if (hasSevere) {
        setPendingIntent({
          itemKind: context.itemKind,
          itemName: context.itemName,
          slotType,
          payload,
          warnings,
          replaceEntryId: context.replaceEntryId,
          date: context.date,
          followUp: context.followUp,
        })
        return
      }

      commitIntent({
        itemKind: context.itemKind,
        itemName: context.itemName,
        slotType,
        payload,
        warnings,
        replaceEntryId: context.replaceEntryId,
        date: context.date,
        followUp: context.followUp,
      })

      if (warnings.length > 0) {
        notifyAllergenWarnings(context.itemName, warnings)
      }
    },
    [commitIntent, notifyAllergenWarnings, patientAllergens],
  )

  const confirmPendingIntent = useCallback(() => {
    if (!pendingIntent) return
    commitIntent(pendingIntent)
    notifyAllergenWarnings(pendingIntent.itemName, pendingIntent.warnings)
    toast.warning(
      `${pendingIntent.itemName} wurde trotz schwerer Allergenwarnung übernommen.`,
    )
    setPendingIntent(null)
  }, [commitIntent, notifyAllergenWarnings, pendingIntent])

  const dismissPendingIntent = useCallback(() => {
    setPendingIntent(null)
  }, [])

  return {
    pendingIntent,
    guardedAddEntry,
    confirmPendingIntent,
    dismissPendingIntent,
  }
}
