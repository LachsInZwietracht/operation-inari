"use client"

import { useState, useCallback, useEffect } from "react"
import type { CounselingSession } from "@/lib/types"
import { COUNSELING_SESSIONS } from "@/lib/mock-data"

const STORAGE_KEY = "prodi_counseling"

function loadFromStorage(): CounselingSession[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as CounselingSession[]
  } catch {
    // Ignore parse errors
  }
  return []
}

function buildInitial(): CounselingSession[] {
  const stored = loadFromStorage()
  const storedIds = new Set(stored.map((s) => s.id))
  const mockOnly = COUNSELING_SESSIONS.filter((s) => !storedIds.has(s.id))
  return [...mockOnly, ...stored].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

export function useCounseling() {
  const [sessions, setSessions] = useState<CounselingSession[]>(buildInitial)

  useEffect(() => {
    try {
      const custom = sessions.filter(
        (s) => !COUNSELING_SESSIONS.find((m) => m.id === s.id),
      )
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
    } catch {
      // Ignore quota errors
    }
  }, [sessions])

  const getSession = useCallback(
    (id: string): CounselingSession | undefined =>
      sessions.find((s) => s.id === id),
    [sessions],
  )

  const getForPatient = useCallback(
    (patientId: string): CounselingSession[] =>
      sessions.filter((s) => s.patientId === patientId),
    [sessions],
  )

  const addSession = useCallback(
    (session: Omit<CounselingSession, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString()
      const newSession: CounselingSession = {
        ...session,
        id: `counseling_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      }
      setSessions((prev) =>
        [...prev, newSession].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      )
      return newSession
    },
    [],
  )

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return {
    sessions,
    getSession,
    getForPatient,
    addSession,
    deleteSession,
  }
}
