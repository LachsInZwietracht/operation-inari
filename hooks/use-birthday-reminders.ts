"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type { BirthdayReminder, Patient } from "@/lib/types"

const STORAGE_KEY = "prodi_birthday_reminders"

interface ReminderState {
  [patientId: string]: string // ISO date up to when congratulations sent
}

function loadState(): ReminderState {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as ReminderState
  } catch {
    return {}
  }
}

export function useBirthdayReminders(patients: Patient[]) {
  const [state, setState] = useState<ReminderState>(loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore storage errors
    }
  }, [state])

  const reminders = useMemo<BirthdayReminder[]>(() => {
    const entries: BirthdayReminder[] = []
    const today = new Date()
    patients.forEach((patient) => {
      const birthDate = new Date(patient.dateOfBirth)
      const next = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())
      if (next < today) next.setFullYear(today.getFullYear() + 1)
      entries.push({
        id: `birthday_${patient.id}`,
        patientId: patient.id,
        dueDate: next.toISOString().slice(0, 10),
        channel: "mail",
        status: state[patient.id] && state[patient.id] >= next.toISOString().slice(0, 10) ? "sent" : "open",
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
      })
    })
    return entries
  }, [patients, state])

  const markSent = useCallback((patientId: string, date: string) => {
    setState((prev) => ({ ...prev, [patientId]: date }))
  }, [])

  return { reminders, markSent }
}
