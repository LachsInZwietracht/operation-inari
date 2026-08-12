import { CardGridSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the plan library. */
export default function BibliothekLoading() {
  return <CardGridSkeleton cards={6} />
}
