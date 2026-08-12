import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves plans and entitlements. */
export default function TarifeLoading() {
  return <TablePageSkeleton rows={6} />
}
