import { DetailPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the plan comparison. */
export default function VergleichLoading() {
  return <DetailPageSkeleton tabs={false} />
}
