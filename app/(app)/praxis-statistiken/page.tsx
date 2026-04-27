import PraxisStatistikenClient from "./praxis-statistiken-client"
import { fetchPracticeOverviewData } from "@/lib/data/practice-overview"

export default async function PraxisStatistikenPage() {
  const initialData = await fetchPracticeOverviewData()

  return <PraxisStatistikenClient initialData={initialData} />
}
