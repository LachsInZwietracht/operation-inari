import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the food browser. */
export default function LebensmittelLoading() {
  return <TablePageSkeleton rows={12} />
}
