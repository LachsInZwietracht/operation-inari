import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the food overview. */
export default function LebensmittelUebersichtLoading() {
  return <TablePageSkeleton rows={12} />
}
