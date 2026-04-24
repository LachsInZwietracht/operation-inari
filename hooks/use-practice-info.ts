"use client"

import { useCallback, useState } from "react"
import type { PracticeInfo } from "@/lib/types"

const STORAGE_KEY = "prodi_practice_info"

const EMPTY: PracticeInfo = { name: "", address: "", phone: "" }

function loadFromStorage(): PracticeInfo {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as PracticeInfo
  } catch {
    // ignore
  }
  return EMPTY
}

export function usePracticeInfo() {
  const [practiceInfo, setPracticeInfoState] = useState<PracticeInfo>(loadFromStorage)

  const setPracticeInfo = useCallback((info: PracticeInfo) => {
    setPracticeInfoState(info)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(info))
    } catch {
      // ignore quota
    }
  }, [])

  const isConfigured = !!practiceInfo.name

  return { practiceInfo, setPracticeInfo, isConfigured }
}
