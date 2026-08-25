"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO, subDays } from "date-fns"

import { isClientCapabilityEnabled, isClientModuleEnabled } from "@/lib/client-modules"
import { todayIsoDate } from "@/lib/client-mode"
import { hydrateClientFoods } from "@/lib/data/client-custom-foods-client"
import { fetchClientFoodLogDays } from "@/lib/data/client-food-log-client"
import { fetchClientLinkForPatient } from "@/lib/data/client-links"
import { fetchClientAdherence } from "@/lib/data/client-plan-client"
import { fetchClientRecipeFacts } from "@/lib/data/client-plan-nutrition-client"
import { fetchClientWellbeingSeries } from "@/lib/data/client-checkin-client"
import { createClient } from "@/lib/supabase/client"
import type {
  ClientAdherenceSummary,
  ClientFoodLogDay,
  ClientLink,
  Food,
  NutrientValue,
} from "@/lib/types"

const PULSE_WINDOW_DAYS = 14
const REFRESH_INTERVAL_MS = 60_000

export interface CounselorClientPulse {
  link: ClientLink | null
  days: ClientFoodLogDay[]
  wellbeing: Map<string, { date: string; value: number }[]>
  adherence: ClientAdherenceSummary
  foods: Map<string, Food>
  recipeFacts: Map<string, { name: string; perPortion: NutrientValue[] }>
  isLoading: boolean
  error: string | null
  refreshedAt: Date | null
  refresh: () => Promise<void>
}

/**
 * The client's current signal for the counselor-side plan cockpit.
 *
 * All reads keep the existing consent boundaries. Wellbeing goes through its
 * RPC, nutrition through the active link's RLS policy, and a missing or
 * revoked link returns an intentionally empty pulse. The minute refresh makes
 * a record left open between appointments current without pretending that an
 * RPC-backed view is a realtime subscription.
 */
export function useCounselorClientPulse(patientId: string): CounselorClientPulse {
  const supabase = useMemo(() => createClient(), [])
  const [link, setLink] = useState<ClientLink | null>(null)
  const [days, setDays] = useState<ClientFoodLogDay[]>([])
  const [wellbeing, setWellbeing] = useState<
    Map<string, { date: string; value: number }[]>
  >(new Map())
  const [adherence, setAdherence] = useState<ClientAdherenceSummary>({
    byDay: [],
    bySlot: [],
  })
  const [foods, setFoods] = useState<Map<string, Food>>(new Map())
  const [recipeFacts, setRecipeFacts] = useState<
    Map<string, { name: string; perPortion: NutrientValue[] }>
  >(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setError(null)

    try {
      const nextLink = await fetchClientLinkForPatient(supabase, patientId)
      setLink(nextLink)

      const clientUserId =
        nextLink?.status === "active" ? nextLink.clientUserId : undefined
      if (!nextLink || !clientUserId) {
        setDays([])
        setWellbeing(new Map())
        setAdherence({ byDay: [], bySlot: [] })
        setFoods(new Map())
        setRecipeFacts(new Map())
        setRefreshedAt(new Date())
        return
      }

      const today = todayIsoDate()
      const range = {
        from: format(subDays(parseISO(today), PULSE_WINDOW_DAYS - 1), "yyyy-MM-dd"),
        to: today,
      }

      const nutritionEnabled =
        nextLink.consentNutrition && isClientModuleEnabled("tagebuch")
      const planEnabled =
        nextLink.consentNutrition && isClientModuleEnabled("plan")
      const wellbeingEnabled =
        nextLink.consentWellbeing && isClientCapabilityEnabled("befinden")

      const [nextDays, nextWellbeing, nextAdherence] =
        await Promise.all([
          nutritionEnabled
            ? fetchClientFoodLogDays(clientUserId, range, supabase)
            : Promise.resolve([]),
          wellbeingEnabled
            ? fetchClientWellbeingSeries(patientId, range, supabase)
            : Promise.resolve(new Map()),
          planEnabled
            ? fetchClientAdherence(patientId, clientUserId, range, supabase)
            : Promise.resolve({ byDay: [], bySlot: [] }),
        ])

      setDays(nextDays)
      setWellbeing(nextWellbeing)
      setAdherence(nextAdherence)

      const foodIds = nextDays.flatMap((day) =>
        day.entries
          .map((entry) => entry.foodId)
          .filter((id): id is string => Boolean(id)),
      )
      const recipeIds = nextDays.flatMap((day) =>
        day.entries
          .map((entry) => entry.recipeId)
          .filter((id): id is string => Boolean(id)),
      )

      const [nextFoods, nextRecipeFacts] = await Promise.all([
        hydrateClientFoods(foodIds, supabase),
        fetchClientRecipeFacts(recipeIds, supabase),
      ])
      setFoods(nextFoods)
      setRecipeFacts(nextRecipeFacts)
      setRefreshedAt(new Date())
    } catch (caught) {
      console.error("Failed to load counselor client pulse:", caught)
      setError("Die aktuellen Klientendaten konnten nicht geladen werden.")
    } finally {
      setIsLoading(false)
    }
  }, [patientId, supabase])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
  }, [refresh])

  return {
    link,
    days,
    wellbeing,
    adherence,
    foods,
    recipeFacts,
    isLoading,
    error,
    refreshedAt,
    refresh,
  }
}
