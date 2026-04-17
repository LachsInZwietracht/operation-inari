"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { Patient } from "@/lib/types"
import { PATIENTS } from "@/lib/mock-data"
import { deletePatientClient, fetchPatientsClient, persistPatient } from "@/lib/data/patients-client"
import { useAuth } from "@/hooks/use-auth"

const STORAGE_KEY = "prodi_patients"

function loadFromStorage(): Patient[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Patient[]
  } catch {
    // Ignore parse errors
  }
  return []
}

function buildInitialPatients(): Patient[] {
  const stored = loadFromStorage()
  const storedIds = new Set(stored.map((p) => p.id))
  const mockOnly = PATIENTS.filter((p) => !storedIds.has(p.id))
  return [...mockOnly, ...stored].sort((a, b) =>
    a.lastName.localeCompare(b.lastName, "de"),
  )
}

function isMockPatient(patient: Patient) {
  return PATIENTS.some((mockPatient) => mockPatient.id === patient.id)
}

function sortPatients(items: Patient[]) {
  return [...items].sort((a, b) => a.lastName.localeCompare(b.lastName, "de"))
}

function getLocalOnlyPatients(items: Patient[]) {
  return items.filter((patient) => !isMockPatient(patient))
}

export function usePatients() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [patients, setPatients] = useState<Patient[]>(buildInitialPatients)
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const migrationDone = useRef(false)
  const patientsRef = useRef<Patient[]>(patients)

  useEffect(() => {
    patientsRef.current = patients
  }, [patients])

  // Sync to local storage for offline/fallback
  useEffect(() => {
    try {
      const custom = getLocalOnlyPatients(patients)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
    } catch {
      // Ignore quota errors
    }
  }, [patients])

  // Load from Supabase when authenticated
  useEffect(() => {
    if (!isAuthenticated || authLoading) return

    let cancelled = false
    setIsLoadingRemote(true)

    async function syncPatients() {
      try {
        const remotePatients = await fetchPatientsClient()
        if (cancelled) return

        const localOnly = getLocalOnlyPatients(patientsRef.current)
        const merged = [...remotePatients]

        for (const local of localOnly) {
          const existsRemote = remotePatients.some(
            (remotePatient) => remotePatient.id === local.id || remotePatient.legacyId === local.id,
          )
          if (!existsRemote) {
            merged.push(local)
          }
        }

        setPatients(sortPatients(merged))

        if (!migrationDone.current) {
          migrationDone.current = true

          // Add local patients that are not yet in remote
          const pendingMigration = localOnly.filter((localPatient) =>
            !remotePatients.some(
              (remotePatient) =>
                remotePatient.id === localPatient.id || remotePatient.legacyId === localPatient.id,
            ),
          )

          for (const patient of pendingMigration) {
            void persistPatient(patient as any).catch((err) => {
              console.error(`Failed to migrate patient ${patient.firstName} ${patient.lastName}:`, err)
            })
          }
        }
      } catch (error) {
        console.error("Failed to sync patients from Supabase:", error)
      } finally {
        if (!cancelled) setIsLoadingRemote(false)
      }
    }

    void syncPatients()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, authLoading])

  const getPatient = useCallback(
    (id: string): Patient | undefined => 
      patients.find((p) => p.id === id || (p.legacyId && p.legacyId === id)),
    [patients],
  )

  const addPatient = useCallback(async (patient: Omit<Patient, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString()
    const tempId = `patient_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const newPatient: Patient = {
      ...patient,
      id: tempId,
      createdAt: now,
      updatedAt: now,
    }

    setPatients((prev) =>
      sortPatients([...prev, newPatient]),
    )
    
    // Background sync - if authenticated, this will return a canonical UUID
    if (isAuthenticated) {
      try {
        const persisted = await persistPatient(newPatient as any)
        setPatients((prev) =>
          sortPatients(prev.map((p) => (p.id === tempId ? persisted : p))),
        )
        return persisted
      } catch (err) {
        console.error("Failed to persist patient:", err)
        throw err
      }
    }
    
    return newPatient
  }, [isAuthenticated])

  const updatePatient = useCallback((id: string, updates: Partial<Patient>) => {
    setPatients((prev) => {
      const next = prev
        .map((p) =>
          (p.id === id || (p.legacyId && p.legacyId === id))
            ? { ...p, ...updates, updatedAt: new Date().toISOString() }
            : p,
        )
      const sortedNext = sortPatients(next)
      
      const updated = sortedNext.find(p => p.id === id || (p.legacyId && p.legacyId === id))
      if (updated && isAuthenticated) {
        void persistPatient(updated as any).then((persisted) => {
           setPatients((prev) => prev.map(p => p.id === persisted.id || p.id === persisted.legacyId ? persisted : p))
        }).catch((err) => {
           console.error("Failed to update patient in Supabase:", err)
        })
      }
      
      return sortedNext
    })
  }, [isAuthenticated])

  const deletePatient = useCallback((id: string) => {
    setPatients((prev) => prev.filter((p) => p.id !== id && p.legacyId !== id))
    if (isAuthenticated) {
      void deletePatientClient(id).catch((err) => {
        console.error("Failed to delete patient in Supabase:", err)
      })
    }
  }, [isAuthenticated])

  return {
    patients,
    getPatient,
    addPatient,
    updatePatient,
    deletePatient,
    isLoadingRemote
  }
}
