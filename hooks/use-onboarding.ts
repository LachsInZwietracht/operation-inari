"use client"

import { useCallback, useState } from "react"
import type { OnboardingStatus } from "@/lib/types"

const STORAGE_KEY = "prodi_onboarding_status"
const PATIENTS_KEY = "prodi_patients"

function loadStatus(): OnboardingStatus {
  if (typeof window === "undefined") return { completed: false }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as OnboardingStatus
  } catch {
    // ignore
  }
  return { completed: false }
}

function hasPatients(): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = localStorage.getItem(PATIENTS_KEY)
    if (!raw) return false
    const arr = JSON.parse(raw)
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

function isPracticeConfigured(): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = localStorage.getItem("prodi_practice_info")
    if (!raw) return false
    const info = JSON.parse(raw)
    return !!info.name
  } catch {
    return false
  }
}

function shouldShowOnboarding(): boolean {
  const status = loadStatus()
  return !status.completed && !status.skippedAt && !hasPatients() && !isPracticeConfigured()
}

export function useOnboarding() {
  const [visible, setVisible] = useState(shouldShowOnboarding)

  const persist = useCallback((next: OnboardingStatus) => {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [])

  const completeOnboarding = useCallback(() => {
    persist({ completed: true, completedAt: new Date().toISOString() })
  }, [persist])

  const skipOnboarding = useCallback(() => {
    persist({ completed: false, skippedAt: new Date().toISOString() })
  }, [persist])

  return { showOnboarding: visible, completeOnboarding, skipOnboarding }
}
