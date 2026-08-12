import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves tray cards. */
export default function TablettenkartenLoading() {
  return <TablePageSkeleton rows={10} />
}
