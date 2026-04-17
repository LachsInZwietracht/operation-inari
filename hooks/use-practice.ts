"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { InvoiceEntry, PracticeAppointment } from "@/lib/types"
import { PRACTICE_APPOINTMENTS, PRACTICE_INVOICES } from "@/lib/mock-data"
import { deleteInvoiceClient, fetchInvoicesClient, persistInvoice } from "@/lib/data/invoices-client"
import { useAuth } from "@/hooks/use-auth"

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
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [invoices, setInvoices] = useState<InvoiceEntry[]>(() => {
    const stored = loadFromStorage<InvoiceEntry>(STORAGE_KEYS.invoices)
    return sortInvoices(stored && stored.length ? stored : PRACTICE_INVOICES)
  })
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const migrationDone = useRef(false)

  // Sync to local storage for offline/fallback
  useEffect(() => {
    try {
      const custom = invoices.filter(
        (inv) => !PRACTICE_INVOICES.find((m) => m.id === inv.id),
      )
      localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(custom))
    } catch {
      // Ignore quota errors
    }
  }, [invoices])

  // Load from Supabase when authenticated
  useEffect(() => {
    if (!isAuthenticated || authLoading) return

    let cancelled = false
    setIsLoadingRemote(true)

    async function syncInvoices() {
      try {
        const remoteInvoices = await fetchInvoicesClient()
        if (cancelled) return

        setInvoices((prev) => {
          const localOnly = prev.filter(
            (inv) => !PRACTICE_INVOICES.find((m) => m.id === inv.id),
          )
          const merged = [...remoteInvoices]

          for (const local of localOnly) {
            const existsRemote = remoteInvoices.some(
              (r) => r.id === local.id || r.legacyId === local.id,
            )
            if (!existsRemote) {
              merged.push(local)
            }
          }

          return sortInvoices(merged)
        })

        // Migrate local-only invoices to Supabase
        if (!migrationDone.current) {
          migrationDone.current = true
          const localOnly = invoices.filter(
            (inv) =>
              !PRACTICE_INVOICES.find((m) => m.id === inv.id) &&
              !remoteInvoices.some(
                (r) => r.id === inv.id || r.legacyId === inv.id,
              ),
          )

          for (const inv of localOnly) {
            void persistInvoice(inv as Parameters<typeof persistInvoice>[0]).catch(
              (err) => {
                console.error(`Failed to migrate invoice ${inv.id}:`, err)
              },
            )
          }
        }
      } catch (error) {
        console.error("Failed to sync invoices from Supabase:", error)
      } finally {
        if (!cancelled) setIsLoadingRemote(false)
      }
    }

    void syncInvoices()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, authLoading])

  const addInvoice = useCallback(
    (payload: Omit<InvoiceEntry, "id">) => {
      const now = new Date().toISOString()
      const tempId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const invoice: InvoiceEntry = {
        ...payload,
        id: tempId,
        createdAt: now,
        updatedAt: now,
      }
      setInvoices((prev) => sortInvoices([...prev, invoice]))

      if (isAuthenticated) {
        void persistInvoice(invoice as Parameters<typeof persistInvoice>[0])
          .then((persisted) => {
            setInvoices((prev) =>
              prev.map((inv) => (inv.id === tempId ? persisted : inv)),
            )
          })
          .catch((err) => {
            console.error("Failed to persist invoice:", err)
          })
      }

      return invoice
    },
    [isAuthenticated],
  )

  const updateInvoice = useCallback(
    (id: string, updates: Partial<InvoiceEntry>) => {
      setInvoices((prev) => {
        const next = sortInvoices(
          prev.map((invoice) =>
            invoice.id === id || (invoice.legacyId && invoice.legacyId === id)
              ? { ...invoice, ...updates, updatedAt: new Date().toISOString() }
              : invoice,
          ),
        )

        const updated = next.find(
          (inv) => inv.id === id || (inv.legacyId && inv.legacyId === id),
        )
        if (updated && isAuthenticated) {
          void persistInvoice(
            updated as Parameters<typeof persistInvoice>[0],
          )
            .then((persisted) => {
              setInvoices((prev2) =>
                prev2.map((inv) =>
                  inv.id === persisted.id || inv.id === persisted.legacyId
                    ? persisted
                    : inv,
                ),
              )
            })
            .catch((err) => {
              console.error("Failed to update invoice in Supabase:", err)
            })
        }

        return next
      })
    },
    [isAuthenticated],
  )

  const markInvoiceStatus = useCallback(
    (id: string, status: InvoiceEntry["status"]) => {
      updateInvoice(id, { status })
    },
    [updateInvoice],
  )

  const deleteInvoice = useCallback(
    (id: string) => {
      setInvoices((prev) =>
        prev.filter((inv) => inv.id !== id && inv.legacyId !== id),
      )
      if (isAuthenticated) {
        void deleteInvoiceClient(id).catch((err) => {
          console.error("Failed to delete invoice in Supabase:", err)
        })
      }
    },
    [isAuthenticated],
  )

  return {
    invoices,
    addInvoice,
    updateInvoice,
    markInvoiceStatus,
    deleteInvoice,
    isLoadingRemote,
  }
}
