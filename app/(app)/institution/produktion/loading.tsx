import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves production batches. */
export default function ProduktionLoading() {
  return <TablePageSkeleton stats={4} rows={8} />
}
