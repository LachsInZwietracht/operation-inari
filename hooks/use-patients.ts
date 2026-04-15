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

export function usePatients() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [patients, setPatients] = useState<Patient[]>(buildInitialPatients)
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const migrationDone = useRef(false)

  // Sync to local storage for offline/fallback
  useEffect(() => {
    try {
      const custom = patients.filter(
        (p) => !PATIENTS.find((m) => m.id === p.id),
      )
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

        setPatients((prev) => {
          const localOnly = prev.filter(p => !PATIENTS.find(m => m.id === p.id))
          const merged = [...remotePatients]
          
          // Add local patients that are not yet in remote
          for (const local of localOnly) {
            const existsRemote = remotePatients.some(
              r => r.id === local.id || r.legacyId === local.id
            )
            if (!existsRemote) {
              merged.push(local)
            }
          }

          return merged.sort((a, b) => a.lastName.localeCompare(b.lastName, "de"))
        })

        // Trigger migration of local-only patients
        if (!migrationDone.current) {
          migrationDone.current = true
          const localOnly = patients.filter(p => 
            !PATIENTS.find(m => m.id === p.id) && 
            !remotePatients.some(r => r.id === p.id || r.legacyId === p.id)
          )
          
          for (const p of localOnly) {
            void persistPatient(p as any).catch(err => {
              console.error(`Failed to migrate patient ${p.firstName} ${p.lastName}:`, err)
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

  const addPatient = useCallback((patient: Omit<Patient, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString()
    const tempId = `patient_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const newPatient: Patient = {
      ...patient,
      id: tempId,
      createdAt: now,
      updatedAt: now,
    }
    
    setPatients((prev) =>
      [...prev, newPatient].sort((a, b) =>
        a.lastName.localeCompare(b.lastName, "de"),
      ),
    )
    
    // Background sync - if authenticated, this will return a canonical UUID
    if (isAuthenticated) {
      void persistPatient(newPatient as any).then((persisted) => {
        setPatients((prev) => 
          prev.map(p => p.id === tempId ? persisted : p)
        )
      }).catch((err) => {
        console.error("Failed to persist patient:", err)
      })
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
        .sort((a, b) => a.lastName.localeCompare(b.lastName, "de"))
      
      const updated = next.find(p => p.id === id || (p.legacyId && p.legacyId === id))
      if (updated && isAuthenticated) {
        void persistPatient(updated as any).then((persisted) => {
           setPatients((prev) => prev.map(p => p.id === persisted.id || p.id === persisted.legacyId ? persisted : p))
        }).catch((err) => {
           console.error("Failed to update patient in Supabase:", err)
        })
      }
      
      return next
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
