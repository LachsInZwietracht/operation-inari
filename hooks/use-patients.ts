"use client"

import { useState, useCallback, useEffect } from "react"
import type { Patient } from "@/lib/types"
import { PATIENTS } from "@/lib/mock-data"

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
  const [patients, setPatients] = useState<Patient[]>(buildInitialPatients)

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

  const getPatient = useCallback(
    (id: string): Patient | undefined => patients.find((p) => p.id === id),
    [patients],
  )

  const addPatient = useCallback((patient: Omit<Patient, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString()
    const newPatient: Patient = {
      ...patient,
      id: `patient_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    }
    setPatients((prev) =>
      [...prev, newPatient].sort((a, b) =>
        a.lastName.localeCompare(b.lastName, "de"),
      ),
    )
    return newPatient
  }, [])

  const updatePatient = useCallback((id: string, updates: Partial<Patient>) => {
    setPatients((prev) =>
      prev
        .map((p) =>
          p.id === id
            ? { ...p, ...updates, updatedAt: new Date().toISOString() }
            : p,
        )
        .sort((a, b) => a.lastName.localeCompare(b.lastName, "de")),
    )
  }, [])

  const deletePatient = useCallback((id: string) => {
    setPatients((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return {
    patients,
    getPatient,
    addPatient,
    updatePatient,
    deletePatient,
  }
}
