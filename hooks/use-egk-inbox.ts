"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type { EgkCardData, EgkScanEvent, Patient } from "@/lib/types"
import { EGK_SCAN_EVENTS } from "@/lib/mock-data"

const STORAGE_KEY = "prodi_egk_events"

function loadFromStorage(): EgkScanEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as EgkScanEvent[]
  } catch {
    return []
  }
}

function buildInitialEvents(): EgkScanEvent[] {
  const stored = loadFromStorage()
  const ids = new Set(stored.map((event) => event.id))
  return [...EGK_SCAN_EVENTS.filter((event) => !ids.has(event.id)), ...stored].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

interface AddEventPayload {
  card: EgkCardData
  patientId?: string
  source: EgkScanEvent["source"]
  status?: EgkScanEvent["status"]
  notes?: string
}

export function useEgkInbox() {
  const [events, setEvents] = useState<EgkScanEvent[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    setEvents(buildInitialEvents())
    setHasLoaded(true)
  }, [])

  useEffect(() => {
    if (!hasLoaded) return
    const custom = events.filter((event) => !EGK_SCAN_EVENTS.find((mock) => mock.id === event.id))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
    } catch {
      // Ignore storage errors
    }
  }, [events, hasLoaded])

  const addEvent = useCallback(({ card, patientId, source, status = "pending", notes }: AddEventPayload) => {
    const timestamp = new Date().toISOString()
    const event: EgkScanEvent = {
      id: `egk_evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      card,
      patientId,
      source,
      status,
      notes,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    setEvents((prev) => [event, ...prev])
    return event
  }, [])

  const linkToPatient = useCallback((eventId: string, patient: Patient) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? {
              ...event,
              patientId: patient.id,
              status: "matched",
              notes: `Automatisch zugeordnet zu ${patient.lastName}`,
              updatedAt: new Date().toISOString(),
            }
          : event,
      ),
    )
  }, [])

  const archiveEvent = useCallback((eventId: string) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? { ...event, status: "archived", updatedAt: new Date().toISOString() }
          : event,
      ),
    )
  }, [])

  const pendingEvents = useMemo(() => events.filter((event) => event.status !== "archived"), [events])

  return {
    events,
    pendingEvents,
    addEvent,
    linkToPatient,
    archiveEvent,
  }
}
