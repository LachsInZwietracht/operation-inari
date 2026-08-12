import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves nutrient compliance. */
export default function ComplianceLoading() {
  return <TablePageSkeleton stats={4} rows={8} />
}
