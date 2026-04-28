import { DashboardOverviewClient } from "./dashboard-overview-client"
import {
  fetchPracticeDashboardSummary,
  fetchPracticeOverviewData,
} from "@/lib/data/practice-overview"

export default async function DashboardPage() {
  const initialSummary = await fetchPracticeDashboardSummary()
  const initialData = initialSummary ? null : await fetchPracticeOverviewData()

  return <DashboardOverviewClient initialData={initialData} initialSummary={initialSummary} />
}
