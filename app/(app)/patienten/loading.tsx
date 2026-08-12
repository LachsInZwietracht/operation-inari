import { ListPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves patients under ongoing care. */
export default function PatientenLoading() {
  return <ListPageSkeleton padded kpis={4} sidePanel rows={6} rowHeight={56} />
}
