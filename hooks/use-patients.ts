"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { Patient } from "@/lib/types"
import { deletePatientClient, fetchPatientsClient, persistPatient } from "@/lib/data/patients-client"
import { isLocalMigrationCandidate, matchesRecordIdentity } from "@/lib/data/local-records"
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

function sortPatients(items: Patient[]) {
  return [...items].sort((a, b) => a.lastName.localeCompare(b.lastName, "de"))
}

function getLocalOnlyPatients(items: Patient[]) {
  return items.filter(isLocalMigrationCandidate)
}

function buildInitialPatients(initialPatients: Patient[] = []): Patient[] {
  const localOnly = getLocalOnlyPatients(loadFromStorage())
  const merged = [...initialPatients]

  for (const local of localOnly) {
    const existsRemote = initialPatients.some((remotePatient) =>
      matchesRecordIdentity(remotePatient, local),
    )
    if (!existsRemote) {
      merged.push(local)
    }
  }

  return sortPatients(merged)
}

interface UsePatientsOptions {
  initialPatients?: Patient[]
}

export function usePatients(options: UsePatientsOptions = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const initialPatientsRef = useRef(options.initialPatients)
  const [patients, setPatients] = useState<Patient[]>(() =>
    buildInitialPatients(options.initialPatients),
  )
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
    const initialRemotePatients = initialPatientsRef.current
    setIsLoadingRemote(!initialRemotePatients)

    async function syncPatients() {
      try {
        const remotePatients = initialRemotePatients ?? await fetchPatientsClient()
        initialPatientsRef.current = undefined
        if (cancelled) return

        const localOnly = getLocalOnlyPatients(patientsRef.current)
        const merged = [...remotePatients]

        for (const local of localOnly) {
          const existsRemote = remotePatients.some((remotePatient) =>
            matchesRecordIdentity(remotePatient, local),
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
            !remotePatients.some((remotePatient) =>
              matchesRecordIdentity(remotePatient, localPatient),
            ),
          )

          for (const patient of pendingMigration) {
            void persistPatient(patient as Parameters<typeof persistPatient>[0]).catch((err) => {
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
        const persisted = await persistPatient(newPatient as Parameters<typeof persistPatient>[0])
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

  /**
   * Updates a patient in local state only.
   *
   * For callers that have already persisted a narrow change themselves.
   * {@link updatePatient} follows up with a full upsert of the whole record,
   * which would rewrite every field from this browser's copy and could undo a
   * colleague's concurrent edit — fine when the form owns the record, wrong
   * when a single column was just written on its own.
   */
  const patchPatientLocal = useCallback((id: string, updates: Partial<Patient>) => {
    setPatients((prev) =>
      sortPatients(
        prev.map((p) =>
          p.id === id || (p.legacyId && p.legacyId === id)
            ? { ...p, ...updates, updatedAt: new Date().toISOString() }
            : p,
        ),
      ),
    )
  }, [])

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
        void persistPatient(updated as Parameters<typeof persistPatient>[0]).then((persisted) => {
           setPatients((prev) => prev.map(p => p.id === persisted.id || p.id === persisted.legacyId ? persisted : p))
        }).catch((err) => {
           console.error("Failed to update patient in Supabase:", err)
        })
      }
      
      return sortedNext
    })
  }, [isAuthenticated])

  /**
   * Persists a deliberate change before reporting success to its caller.
   * Forms that own the whole record can still use updatePatient's responsive
   * background save, while short clinical actions can show an honest result.
   */
  const savePatient = useCallback(async (id: string, updates: Partial<Patient>) => {
    const current = patientsRef.current.find(
      (patient) => patient.id === id || patient.legacyId === id,
    )
    if (!current) throw new Error("Patient nicht gefunden")

    const optimistic = { ...current, ...updates, updatedAt: new Date().toISOString() }
    setPatients((previous) =>
      sortPatients(previous.map((patient) =>
        patient.id === id || patient.legacyId === id ? optimistic : patient,
      )),
    )

    if (!isAuthenticated) return optimistic

    try {
      const persisted = await persistPatient(optimistic as Parameters<typeof persistPatient>[0])
      setPatients((previous) =>
        sortPatients(previous.map((patient) =>
          patient.id === id || patient.legacyId === id ? persisted : patient,
        )),
      )
      return persisted
    } catch (error) {
      setPatients((previous) =>
        sortPatients(previous.map((patient) =>
          patient.id === id || patient.legacyId === id ? current : patient,
        )),
      )
      throw error
    }
  }, [isAuthenticated])

  const deletePatient = useCallback(async (id: string) => {
    let removedPatient: Patient | undefined

    setPatients((prev) => {
      removedPatient = prev.find((p) => p.id === id || p.legacyId === id)
      return prev.filter((p) => p.id !== id && p.legacyId !== id)
    })

    if (!isAuthenticated) return true

    try {
      await deletePatientClient(id)
      return true
    } catch (err) {
      console.error("Failed to delete patient in Supabase:", err)
      if (removedPatient) {
        const patientToRestore = removedPatient
        setPatients((prev) => sortPatients([...prev, patientToRestore]))
      }
      return false
    }
  }, [isAuthenticated])

  return {
    patients,
    getPatient,
    addPatient,
    updatePatient,
    savePatient,
    patchPatientLocal,
    deletePatient,
    isLoadingRemote
  }
}
