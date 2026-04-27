"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { InvoiceEntry, PracticeAppointment } from "@/lib/types"
import { deleteInvoiceClient, fetchInvoicesClient, persistInvoice } from "@/lib/data/invoices-client"
import { deleteAppointmentClient, fetchAppointmentsClient, persistAppointment } from "@/lib/data/appointments-client"
import { isLocalMigrationCandidate, matchesRecordIdentity } from "@/lib/data/local-records"
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

interface UsePracticeAppointmentsOptions {
  initialAppointments?: PracticeAppointment[]
}

interface UsePracticeInvoicesOptions {
  initialInvoices?: InvoiceEntry[]
}

function buildInitialAppointments(initialAppointments: PracticeAppointment[] = []) {
  const stored = loadFromStorage<PracticeAppointment>(STORAGE_KEYS.appointments) ?? []
  const localOnly = stored.filter(isLocalMigrationCandidate)
  const merged = [...initialAppointments]

  for (const local of localOnly) {
    const existsRemote = initialAppointments.some((remoteAppointment) =>
      matchesRecordIdentity(remoteAppointment, local),
    )
    if (!existsRemote) {
      merged.push(local)
    }
  }

  return sortAppointments(merged)
}

function buildInitialInvoices(initialInvoices: InvoiceEntry[] = []) {
  const stored = loadFromStorage<InvoiceEntry>(STORAGE_KEYS.invoices) ?? []
  const localOnly = stored.filter(isLocalMigrationCandidate)
  const merged = [...initialInvoices]

  for (const local of localOnly) {
    const existsRemote = initialInvoices.some((remoteInvoice) =>
      matchesRecordIdentity(remoteInvoice, local),
    )
    if (!existsRemote) {
      merged.push(local)
    }
  }

  return sortInvoices(merged)
}

export function usePracticeAppointments(options: UsePracticeAppointmentsOptions = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const initialAppointmentsRef = useRef(options.initialAppointments)
  const [appointments, setAppointments] = useState<PracticeAppointment[]>(() =>
    buildInitialAppointments(options.initialAppointments),
  )
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const migrationDone = useRef(false)
  const appointmentsRef = useRef(appointments)

  useEffect(() => {
    appointmentsRef.current = appointments
  }, [appointments])

  // Sync to local storage for offline/fallback
  useEffect(() => {
    try {
      persistToStorage(
        STORAGE_KEYS.appointments,
        appointments.filter(isLocalMigrationCandidate),
      )
    } catch {
      // Ignore quota errors
    }
  }, [appointments])

  // Load from Supabase when authenticated
  useEffect(() => {
    if (!isAuthenticated || authLoading) return

    let cancelled = false
    const initialRemoteAppointments = initialAppointmentsRef.current
    setIsLoadingRemote(!initialRemoteAppointments)

    async function syncAppointments() {
      try {
        const remoteAppointments = initialRemoteAppointments ?? await fetchAppointmentsClient()
        initialAppointmentsRef.current = undefined
        if (cancelled) return

        setAppointments((prev) => {
          const localOnly = prev.filter(isLocalMigrationCandidate)
          const merged = [...remoteAppointments]

          for (const local of localOnly) {
            const existsRemote = remoteAppointments.some((remoteAppointment) =>
              matchesRecordIdentity(remoteAppointment, local),
            )
            if (!existsRemote) {
              merged.push(local)
            }
          }

          return sortAppointments(merged)
        })

        // Migrate local-only appointments to Supabase
        if (!migrationDone.current) {
          migrationDone.current = true
          const localOnly = appointmentsRef.current.filter(
            (appointment) =>
              isLocalMigrationCandidate(appointment) &&
              !remoteAppointments.some((remoteAppointment) =>
                matchesRecordIdentity(remoteAppointment, appointment),
              ),
          )

          for (const appt of localOnly) {
            void persistAppointment(appt as Parameters<typeof persistAppointment>[0]).catch(
              (err) => {
                console.error(`Failed to migrate appointment ${appt.id}:`, err)
              },
            )
          }
        }
      } catch (error) {
        console.error("Failed to sync appointments from Supabase:", error)
      } finally {
        if (!cancelled) setIsLoadingRemote(false)
      }
    }

    void syncAppointments()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, authLoading])

  const addAppointment = useCallback(
    (payload: Omit<PracticeAppointment, "id">) => {
      const now = new Date().toISOString()
      const tempId = `appt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const newAppointment: PracticeAppointment = {
        ...payload,
        id: tempId,
        createdAt: now,
        updatedAt: now,
      }
      setAppointments((prev) => sortAppointments([...prev, newAppointment]))

      if (isAuthenticated) {
        void persistAppointment(newAppointment as Parameters<typeof persistAppointment>[0])
          .then((persisted) => {
            setAppointments((prev) =>
              prev.map((appt) => (appt.id === tempId ? persisted : appt)),
            )
          })
          .catch((err) => {
            console.error("Failed to persist appointment:", err)
          })
      }

      return newAppointment
    },
    [isAuthenticated],
  )

  const updateAppointment = useCallback(
    (id: string, updates: Partial<PracticeAppointment>) => {
      setAppointments((prev) => {
        const next = sortAppointments(
          prev.map((appointment) =>
            appointment.id === id || (appointment.legacyId && appointment.legacyId === id)
              ? { ...appointment, ...updates, updatedAt: new Date().toISOString() }
              : appointment,
          ),
        )

        const updated = next.find(
          (appt) => appt.id === id || (appt.legacyId && appt.legacyId === id),
        )
        if (updated && isAuthenticated) {
          void persistAppointment(
            updated as Parameters<typeof persistAppointment>[0],
          )
            .then((persisted) => {
              setAppointments((prev2) =>
                prev2.map((appt) =>
                  appt.id === persisted.id || appt.id === persisted.legacyId
                    ? persisted
                    : appt,
                ),
              )
            })
            .catch((err) => {
              console.error("Failed to update appointment in Supabase:", err)
            })
        }

        return next
      })
    },
    [isAuthenticated],
  )

  const deleteAppointment = useCallback(
    (id: string) => {
      setAppointments((prev) =>
        prev.filter((appt) => appt.id !== id && appt.legacyId !== id),
      )
      if (isAuthenticated) {
        void deleteAppointmentClient(id).catch((err) => {
          console.error("Failed to delete appointment in Supabase:", err)
        })
      }
    },
    [isAuthenticated],
  )

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
    isLoadingRemote,
  }
}

export function usePracticeInvoices(options: UsePracticeInvoicesOptions = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const initialInvoicesRef = useRef(options.initialInvoices)
  const [invoices, setInvoices] = useState<InvoiceEntry[]>(() =>
    buildInitialInvoices(options.initialInvoices),
  )
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const migrationDone = useRef(false)
  const invoicesRef = useRef(invoices)

  useEffect(() => {
    invoicesRef.current = invoices
  }, [invoices])

  // Sync to local storage for offline/fallback
  useEffect(() => {
    try {
      persistToStorage(
        STORAGE_KEYS.invoices,
        invoices.filter(isLocalMigrationCandidate),
      )
    } catch {
      // Ignore quota errors
    }
  }, [invoices])

  // Load from Supabase when authenticated
  useEffect(() => {
    if (!isAuthenticated || authLoading) return

    let cancelled = false
    const initialRemoteInvoices = initialInvoicesRef.current
    setIsLoadingRemote(!initialRemoteInvoices)

    async function syncInvoices() {
      try {
        const remoteInvoices = initialRemoteInvoices ?? await fetchInvoicesClient()
        initialInvoicesRef.current = undefined
        if (cancelled) return

        setInvoices((prev) => {
          const localOnly = prev.filter(isLocalMigrationCandidate)
          const merged = [...remoteInvoices]

          for (const local of localOnly) {
            const existsRemote = remoteInvoices.some((remoteInvoice) =>
              matchesRecordIdentity(remoteInvoice, local),
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
          const localOnly = invoicesRef.current.filter(
            (invoice) =>
              isLocalMigrationCandidate(invoice) &&
              !remoteInvoices.some((remoteInvoice) =>
                matchesRecordIdentity(remoteInvoice, invoice),
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
