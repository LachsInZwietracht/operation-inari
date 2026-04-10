"use client"

import { useState, useCallback, useEffect } from "react"
import type {
  CounselingMaterial,
  CounselingProgressMetric,
  CounselingSession,
  CounselingTimelineEntry,
} from "@/lib/types"
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

  const updateSession = useCallback(
    (id: string, updater: (session: CounselingSession) => Partial<CounselingSession>) => {
      const updatedAt = new Date().toISOString()
      setSessions((prev) =>
        prev.map((session) =>
          session.id === id ? { ...session, ...updater(session), updatedAt } : session,
        ),
      )
    },
    [],
  )

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const addTimelineEntry = useCallback(
    (sessionId: string, entry: Omit<CounselingTimelineEntry, "id">) => {
      const entryWithId: CounselingTimelineEntry = {
        ...entry,
        id: `timeline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      }
      updateSession(sessionId, (session) => ({
        timeline: [...(session.timeline ?? []), entryWithId],
      }))
    },
    [updateSession],
  )

  const updateTimelineStatus = useCallback(
    (sessionId: string, entryId: string, status: CounselingTimelineEntry["status"]) => {
      updateSession(sessionId, (session) => ({
        timeline: (session.timeline ?? []).map((entry) =>
          entry.id === entryId ? { ...entry, status } : entry,
        ),
      }))
    },
    [updateSession],
  )

  const addMaterial = useCallback(
    (sessionId: string, material: Omit<CounselingMaterial, "id">) => {
      const materialWithId: CounselingMaterial = {
        ...material,
        id: `material_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      }
      updateSession(sessionId, (session) => ({
        materials: [...(session.materials ?? []), materialWithId],
      }))
    },
    [updateSession],
  )

  const updateMaterialStatus = useCallback(
    (sessionId: string, materialId: string, status: CounselingMaterial["status"]) => {
      updateSession(sessionId, (session) => ({
        materials: (session.materials ?? []).map((material) =>
          material.id === materialId ? { ...material, status } : material,
        ),
      }))
    },
    [updateSession],
  )

  const updateProgressMetric = useCallback(
    (sessionId: string, metricId: string, value: number, trend?: CounselingProgressMetric["trend"]) => {
      updateSession(sessionId, (session) => ({
        progress: (session.progress ?? []).map((metric) =>
          metric.id === metricId ? { ...metric, value, trend } : metric,
        ),
      }))
    },
    [updateSession],
  )

  const addProgressMetric = useCallback(
    (sessionId: string, metric: Omit<CounselingProgressMetric, "id">) => {
      const metricWithId: CounselingProgressMetric = {
        ...metric,
        id: `progress_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      }
      updateSession(sessionId, (session) => ({
        progress: [...(session.progress ?? []), metricWithId],
      }))
    },
    [updateSession],
  )

  return {
    sessions,
    getSession,
    getForPatient,
    addSession,
    updateSession,
    addTimelineEntry,
    updateTimelineStatus,
    addMaterial,
    updateMaterialStatus,
    updateProgressMetric,
    addProgressMetric,
    deleteSession,
  }
}
