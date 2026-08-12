import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves reference values. */
export default function ReferenzwerteLoading() {
  return <TablePageSkeleton rows={10} />
}
