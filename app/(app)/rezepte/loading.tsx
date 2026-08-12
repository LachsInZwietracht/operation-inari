import { CardGridSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves recipes. */
export default function RezepteLoading() {
  return <CardGridSkeleton cards={6} />
}
