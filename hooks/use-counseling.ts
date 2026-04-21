"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import type {
  CounselingMaterial,
  CounselingProgressMetric,
  CounselingSession,
  CounselingTimelineEntry,
} from "@/lib/types"
import { COUNSELING_SESSIONS } from "@/lib/mock-data"
import {
  deleteCounselingSessionClient,
  fetchCounselingSessionsClient,
  persistCounselingSession,
} from "@/lib/data/counseling-client"
import { useAuth } from "@/hooks/use-auth"

const STORAGE_KEY = "prodi_counseling"
const MAX_MIGRATION_RETRIES = 3

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

function sortSessions(list: CounselingSession[]): CounselingSession[] {
  return [...list].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

function buildInitial(): CounselingSession[] {
  const stored = loadFromStorage()
  const storedIds = new Set(stored.flatMap((session) => [session.id, session.legacyId].filter(Boolean)))
  const mockOnly = COUNSELING_SESSIONS.filter((session) => !storedIds.has(session.id))
  return sortSessions([...mockOnly, ...stored])
}

function isMockSession(session: CounselingSession) {
  return COUNSELING_SESSIONS.some((mockEntry) => mockEntry.id === session.id)
}

function getLocalOnlySessions(sessions: CounselingSession[]) {
  return sessions.filter((session) => !isMockSession(session))
}

export function useCounseling() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<CounselingSession[]>(buildInitial)
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const migrationDone = useRef(false)
  const migrationRetryCounts = useRef<Record<string, number>>({})
  const sessionsRef = useRef<CounselingSession[]>(sessions)

  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getLocalOnlySessions(sessions)))
    } catch {
      // Ignore quota errors
    }
  }, [sessions])

  useEffect(() => {
    if (!isAuthenticated || authLoading) return

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    setIsLoadingRemote(true)

    async function syncSessions() {
      try {
        const remoteSessions = await fetchCounselingSessionsClient()
        if (cancelled) return

        const localOnly = getLocalOnlySessions(sessionsRef.current)
        const merged = [...remoteSessions]

        for (const localSession of localOnly) {
          const existsRemote = remoteSessions.some(
            (remoteSession) =>
              remoteSession.id === localSession.id || remoteSession.legacyId === localSession.id,
          )
          if (!existsRemote) {
            merged.push(localSession)
          }
        }

        setSessions(sortSessions(merged))

        if (!migrationDone.current) {
          const pendingMigration = localOnly.filter(
            (localSession) =>
              !remoteSessions.some(
                (remoteSession) =>
                  remoteSession.id === localSession.id || remoteSession.legacyId === localSession.id,
              ),
          )

          let shouldRetryMigration = false
          let hasPendingMigration = false
          for (const session of pendingMigration) {
            try {
              const persisted = await persistCounselingSession(
                session as Parameters<typeof persistCounselingSession>[0],
              )
              if (cancelled) return
              delete migrationRetryCounts.current[session.id]
              setSessions((current) =>
                sortSessions(
                  current.map((entry) =>
                    entry.id === session.id ? persisted : entry,
                  ),
                ),
              )
            } catch (error) {
              if (
                error instanceof Error &&
                error.message.startsWith("PATIENT_NOT_FOUND:")
              ) {
                const retries = (migrationRetryCounts.current[session.id] ?? 0) + 1
                migrationRetryCounts.current[session.id] = retries

                if (retries < MAX_MIGRATION_RETRIES) {
                  shouldRetryMigration = true
                  hasPendingMigration = true
                } else {
                  console.warn(
                    `Skipping counseling session migration after ${MAX_MIGRATION_RETRIES} missing-patient retries: ${session.id}`,
                  )
                }
              } else {
                console.error(`Failed to migrate counseling session ${session.id}:`, error)
              }
            }
          }

          if (shouldRetryMigration && hasPendingMigration) {
            retryTimer = setTimeout(() => {
              if (!cancelled) {
                void syncSessions()
              }
            }, 2000)
          } else {
            migrationDone.current = true
          }
        }
      } catch (error) {
        console.error("Failed to sync counseling sessions from Supabase:", error)
      } finally {
        if (!cancelled) setIsLoadingRemote(false)
      }
    }

    void syncSessions()

    return () => {
      cancelled = true
      if (retryTimer) {
        clearTimeout(retryTimer)
      }
    }
  }, [isAuthenticated, authLoading])

  const getSession = useCallback(
    (id: string): CounselingSession | undefined =>
      sessions.find((session) => session.id === id || session.legacyId === id),
    [sessions],
  )

  const getForPatient = useCallback(
    (patientId: string): CounselingSession[] =>
      sessions.filter((session) => session.patientId === patientId),
    [sessions],
  )

  const addSession = useCallback(
    async (session: Omit<CounselingSession, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString()
      const tempId = `counseling_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const draftSession: CounselingSession = {
        ...session,
        id: tempId,
        createdAt: now,
        updatedAt: now,
      }

      setSessions((prev) => sortSessions([...prev, draftSession]))

      if (!isAuthenticated) {
        return draftSession
      }

      try {
        const persisted = await persistCounselingSession(
          draftSession as Parameters<typeof persistCounselingSession>[0],
        )

        setSessions((prev) =>
          sortSessions(
            prev.map((entry) => (entry.id === tempId ? persisted : entry)),
          ),
        )

        return persisted
      } catch (error) {
        console.error("Failed to persist counseling session:", error)
        return draftSession
      }
    },
    [isAuthenticated],
  )

  const updateSession = useCallback(
    (id: string, updater: (session: CounselingSession) => Partial<CounselingSession>) => {
      const existing = sessionsRef.current.find((session) => session.id === id || session.legacyId === id)
      if (!existing) return

      const updated: CounselingSession = {
        ...existing,
        ...updater(existing),
        updatedAt: new Date().toISOString(),
      }

      setSessions((prev) =>
        sortSessions(
          prev.map((session) =>
            session.id === id || session.legacyId === id
              ? updated
              : session,
          ),
        ),
      )

      if (!isAuthenticated) return

      void persistCounselingSession(
        updated as Parameters<typeof persistCounselingSession>[0],
      )
        .then((persisted) => {
          setSessions((current) =>
            sortSessions(
              current.map((session) =>
                session.id === id || session.id === persisted.legacyId || session.legacyId === id
                  ? persisted
                  : session,
              ),
            ),
          )
        })
        .catch((error) => {
          console.error("Failed to update counseling session in Supabase:", error)
        })
    },
    [isAuthenticated],
  )

  const deleteSession = useCallback(
    (id: string) => {
      const deletedSession = sessionsRef.current.find(
        (session) => session.id === id || session.legacyId === id,
      )
      if (!deletedSession) return

      setSessions((prev) => prev.filter((session) => session.id !== id && session.legacyId !== id))

      if (isAuthenticated) {
        void deleteCounselingSessionClient(id).catch((error) => {
          console.error("Failed to delete counseling session in Supabase:", error)
          setSessions((prev) => {
            const alreadyRestored = prev.some(
              (session) =>
                session.id === deletedSession.id || session.legacyId === deletedSession.id,
            )
            if (alreadyRestored) return prev
            return sortSessions([...prev, deletedSession])
          })
          toast.error("Beratung konnte nicht gelöscht werden")
        })
      }
    },
    [isAuthenticated],
  )

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
    isLoadingRemote,
  }
}
