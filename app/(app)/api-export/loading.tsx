import { CardGridSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves export targets and API keys. */
export default function ApiExportLoading() {
  return <CardGridSkeleton cards={4} />
}
