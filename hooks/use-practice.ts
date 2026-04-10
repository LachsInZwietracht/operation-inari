"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { InvoiceEntry, PracticeAppointment } from "@/lib/types"
import { PRACTICE_APPOINTMENTS, PRACTICE_INVOICES } from "@/lib/mock-data"

const STORAGE_KEYS = {
  appointments: "prodi_practice_appointments",
  invoices: "prodi_practice_invoices",
}

function sortAppointments(list: PracticeAppointment[]): PracticeAppointment[] {
  return [...list].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.startTime}`)
    const dateB = new Date(`${b.date}T${b.startTime}`)
    return dateA.getTime() - dateB.getTime()
  })
}

function sortInvoices(list: InvoiceEntry[]): InvoiceEntry[] {
  return [...list].sort((a, b) => {
    const dateA = new Date(a.dueDate)
    const dateB = new Date(b.dueDate)
    return dateA.getTime() - dateB.getTime()
  })
}

function loadFromStorage<T>(key: string): T[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T[]
  } catch {
    return null
  }
}

function persistToStorage<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore quota errors
  }
}

export function usePracticeAppointments() {
  const [appointments, setAppointments] = useState<PracticeAppointment[]>(() => {
    const stored = loadFromStorage<PracticeAppointment>(STORAGE_KEYS.appointments)
    return sortAppointments(stored && stored.length ? stored : PRACTICE_APPOINTMENTS)
  })

  useEffect(() => {
    persistToStorage(STORAGE_KEYS.appointments, appointments)
  }, [appointments])

  const addAppointment = useCallback(
    (payload: Omit<PracticeAppointment, "id">) => {
      const newAppointment: PracticeAppointment = {
        ...payload,
        id: `appt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      }
      setAppointments((prev) => sortAppointments([...prev, newAppointment]))
      return newAppointment
    },
    [],
  )

  const updateAppointment = useCallback((id: string, updates: Partial<PracticeAppointment>) => {
    setAppointments((prev) =>
      sortAppointments(
        prev.map((appointment) =>
          appointment.id === id ? { ...appointment, ...updates } : appointment,
        ),
      ),
    )
  }, [])

  const deleteAppointment = useCallback((id: string) => {
    setAppointments((prev) => prev.filter((appointment) => appointment.id !== id))
  }, [])

  const upcomingAppointments = useMemo(() => {
    const now = new Date().getTime()
    return appointments.filter((appointment) => {
      const start = new Date(`${appointment.date}T${appointment.startTime}`).getTime()
      return start >= now
    })
  }, [appointments])

  return {
    appointments,
    upcomingAppointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
  }
}

export function usePracticeInvoices() {
  const [invoices, setInvoices] = useState<InvoiceEntry[]>(() => {
    const stored = loadFromStorage<InvoiceEntry>(STORAGE_KEYS.invoices)
    return sortInvoices(stored && stored.length ? stored : PRACTICE_INVOICES)
  })

  useEffect(() => {
    persistToStorage(STORAGE_KEYS.invoices, invoices)
  }, [invoices])

  const addInvoice = useCallback((payload: Omit<InvoiceEntry, "id">) => {
    const invoice: InvoiceEntry = {
      ...payload,
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    }
    setInvoices((prev) => sortInvoices([...prev, invoice]))
    return invoice
  }, [])

  const updateInvoice = useCallback((id: string, updates: Partial<InvoiceEntry>) => {
    setInvoices((prev) =>
      sortInvoices(
        prev.map((invoice) =>
          invoice.id === id
            ? {
                ...invoice,
                ...updates,
              }
            : invoice,
        ),
      ),
    )
  }, [])

  const markInvoiceStatus = useCallback(
    (id: string, status: InvoiceEntry["status"]) => {
      updateInvoice(id, { status })
    },
    [updateInvoice],
  )

  return {
    invoices,
    addInvoice,
    updateInvoice,
    markInvoiceStatus,
  }
}
