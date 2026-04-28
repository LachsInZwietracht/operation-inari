import PraxisStatistikenClient from "./praxis-statistiken-client"
import {
  fetchPracticeOverviewData,
  fetchPracticeStatisticsSummary,
} from "@/lib/data/practice-overview"

export default async function PraxisStatistikenPage() {
  const initialSummary = await fetchPracticeStatisticsSummary()
  const initialData = initialSummary ? null : await fetchPracticeOverviewData()

  return <PraxisStatistikenClient initialData={initialData} initialSummary={initialSummary} />
}
