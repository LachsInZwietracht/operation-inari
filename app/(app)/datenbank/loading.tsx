import { CardGridSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves data sources. */
export default function DatenbankLoading() {
  return <CardGridSkeleton cards={6} />
}
