import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves appointments. */
export default function TermineLoading() {
  return <TablePageSkeleton stats={4} rows={8} />
}
