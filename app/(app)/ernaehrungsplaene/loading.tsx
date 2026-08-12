import { CardGridSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves saved nutrition plans. */
export default function ErnaehrungsplaeneLoading() {
  return <CardGridSkeleton cards={6} />
}
