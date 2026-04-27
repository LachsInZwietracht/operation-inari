import { DashboardOverviewClient } from "./dashboard-overview-client"
import { fetchPracticeOverviewData } from "@/lib/data/practice-overview"

export default async function DashboardPage() {
  const initialData = await fetchPracticeOverviewData()

  return <DashboardOverviewClient initialData={initialData} />
}
