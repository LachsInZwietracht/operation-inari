import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves wards and stays. */
export default function KrankenhausLoading() {
  return <TablePageSkeleton stats={4} rows={8} />
}
