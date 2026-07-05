import type { CounselingSession, InvoiceEntry, Patient, PracticeAppointment } from "@/lib/types"
import { createClient } from "@/lib/supabase/server"
import { createLogger } from "@/lib/log"
import { fetchPatients } from "@/lib/data/patients"
import { fetchAppointmentsClient } from "@/lib/data/appointments-client"
import { fetchInvoicesClient } from "@/lib/data/invoices-client"
import { fetchCounselingSessionsClient } from "@/lib/data/counseling-client"

const log = createLogger("data/practice-overview")

export interface PracticeDashboardActivity {
  id: string
  type: "patient" | "appointment" | "counseling" | "invoice"
  title: string
  timestamp: string
}

export interface PracticeDashboardAppointment {
  id: string
  date: string
  startTime: string
  endTime: string
  type: PracticeAppointment["type"]
  name: string
}

export interface PracticeDashboardBirthday {
  patientId: string
  firstName: string
  lastName: string
  dueDate: string
}

export interface PracticeDashboardRevenuePoint {
  month: string
  sortKey: string
  bezahlt: number
  offen: number
}

export interface PracticeDashboardSummary {
  activePatients: number
  currentNewPatients: number
  previousNewPatients: number
  upcomingAppointmentsTotal: number
  next7DaysAppointments: number
  openInvoicesCount: number
  openInvoicesAmount: number
  currentMonthSessions: number
  previousMonthSessions: number
  activityFeed: PracticeDashboardActivity[]
  revenueData: PracticeDashboardRevenuePoint[]
  nextAppointments: PracticeDashboardAppointment[]
  upcomingBirthdays: PracticeDashboardBirthday[]
  isEmptyWorkspace: boolean
}

export type PracticeStatisticsRangeKey = "month" | "quarter" | "year" | "all"

export interface PracticeStatisticsNumberStats {
  mean: number
  min: number
  max: number
  std: number
}

export interface PracticeStatisticsTimelinePoint {
  iso: string
  label: string
  appointments: number
  patientSlots: number
}

export interface PracticeStatisticsTypePoint {
  type: string
  termine: number
  patienten: number
}

export interface PracticeStatisticsRevenuePoint {
  month: string
  sortKey: string
  bezahlt: number
  offen: number
}

export interface PracticeStatisticsNewPatientsPoint {
  month: string
  sortKey: string
  count: number
}

export interface PracticeStatisticsOverdueInvoice {
  id: string
  service: string
  dueDate: string
  amount: number
}

export interface PracticeStatisticsRangeSummary {
  appointmentTimeline: PracticeStatisticsTimelinePoint[]
  typeBreakdown: PracticeStatisticsTypePoint[]
  monthlyRevenueData: PracticeStatisticsRevenuePoint[]
  newPatientsPerMonth: PracticeStatisticsNewPatientsPoint[]
  durationStats: PracticeStatisticsNumberStats
  invoiceStats: PracticeStatisticsNumberStats
  uniquePatients: number
  totalRevenue: number
  outstandingRevenue: number
  paymentRate: number
  averageTicket: number
  recurringShare: number
  overdueInvoices: PracticeStatisticsOverdueInvoice[]
}

export interface PracticeStatisticsDistributionPoint {
  name: string
  value: number
}

export interface PracticeStatisticsIndicationPoint {
  name: string
  count: number
}

export interface PracticeStatisticsSummary {
  activePatients: number
  currentNewPatients: number
  previousNewPatients: number
  currentMonthAppointments: number
  previousMonthAppointments: number
  currentAvgDuration: number
  previousAvgDuration: number
  currentRevenue: number
  previousRevenue: number
  appointmentsThisWeek: number
  genderDistribution: PracticeStatisticsDistributionPoint[]
  topIndications: PracticeStatisticsIndicationPoint[]
  ranges: Record<PracticeStatisticsRangeKey, PracticeStatisticsRangeSummary>
}

export interface PracticeOverviewData {
  patients: Patient[]
  appointments: PracticeAppointment[]
  invoices: InvoiceEntry[]
  counselingSessions: CounselingSession[]
}

async function orEmpty<T>(promise: Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await promise
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.warn("Failed to load data for practice overview", { label, error: message })
    return []
  }
}

function isPracticeDashboardSummary(value: unknown): value is PracticeDashboardSummary {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<PracticeDashboardSummary>
  return (
    typeof candidate.activePatients === "number" &&
    typeof candidate.currentNewPatients === "number" &&
    typeof candidate.previousNewPatients === "number" &&
    typeof candidate.upcomingAppointmentsTotal === "number" &&
    typeof candidate.next7DaysAppointments === "number" &&
    typeof candidate.openInvoicesCount === "number" &&
    typeof candidate.openInvoicesAmount === "number" &&
    typeof candidate.currentMonthSessions === "number" &&
    typeof candidate.previousMonthSessions === "number" &&
    Array.isArray(candidate.activityFeed) &&
    Array.isArray(candidate.revenueData) &&
    Array.isArray(candidate.nextAppointments) &&
    Array.isArray(candidate.upcomingBirthdays) &&
    typeof candidate.isEmptyWorkspace === "boolean"
  )
}

function isPracticeStatisticsSummary(value: unknown): value is PracticeStatisticsSummary {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<PracticeStatisticsSummary>
  const ranges = candidate.ranges as Partial<
    Record<PracticeStatisticsRangeKey, PracticeStatisticsRangeSummary>
  > | undefined
  return (
    typeof candidate.activePatients === "number" &&
    typeof candidate.currentNewPatients === "number" &&
    typeof candidate.previousNewPatients === "number" &&
    typeof candidate.currentMonthAppointments === "number" &&
    typeof candidate.previousMonthAppointments === "number" &&
    typeof candidate.currentAvgDuration === "number" &&
    typeof candidate.previousAvgDuration === "number" &&
    typeof candidate.currentRevenue === "number" &&
    typeof candidate.previousRevenue === "number" &&
    typeof candidate.appointmentsThisWeek === "number" &&
    Array.isArray(candidate.genderDistribution) &&
    Array.isArray(candidate.topIndications) &&
    Boolean(ranges?.month) &&
    Boolean(ranges?.quarter) &&
    Boolean(ranges?.year) &&
    Boolean(ranges?.all)
  )
}

export async function fetchPracticeDashboardSummary(): Promise<PracticeDashboardSummary | null> {
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true"
  const authOptional = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authDisabled || authOptional) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    log.warn("Failed to resolve user for practice dashboard summary", { error: authError.message })
    return null
  }

  if (!user) {
    return null
  }

  const { data, error } = await supabase.rpc("get_practice_dashboard_summary")

  if (error) {
    log.warn("Falling back from practice dashboard summary RPC", { error: error.message })
    return null
  }

  if (!isPracticeDashboardSummary(data)) {
    log.warn("Falling back from practice dashboard summary RPC: unexpected response shape")
    return null
  }

  return data
}

export async function fetchPracticeStatisticsSummary(): Promise<PracticeStatisticsSummary | null> {
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true"
  const authOptional = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authDisabled || authOptional) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    log.warn("Failed to resolve user for practice statistics summary", { error: authError.message })
    return null
  }

  if (!user) {
    return null
  }

  const { data, error } = await supabase.rpc("get_practice_statistics_summary")

  if (error) {
    log.warn("Falling back from practice statistics summary RPC", { error: error.message })
    return null
  }

  if (!isPracticeStatisticsSummary(data)) {
    log.warn("Falling back from practice statistics summary RPC: unexpected response shape")
    return null
  }

  return data
}

export async function fetchPracticeOverviewData(): Promise<PracticeOverviewData | null> {
  const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true"
  const authOptional = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authDisabled || authOptional) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    log.warn("Failed to resolve user for practice overview", { error: error.message })
    return null
  }

  if (!user) {
    return null
  }

  const [patients, appointments, invoices, counselingSessions] = await Promise.all([
    fetchPatients(supabase),
    orEmpty(fetchAppointmentsClient(supabase), "appointments"),
    orEmpty(fetchInvoicesClient(supabase), "invoices"),
    orEmpty(fetchCounselingSessionsClient(supabase), "counseling sessions"),
  ])

  return {
    patients,
    appointments,
    invoices,
    counselingSessions,
  }
}
