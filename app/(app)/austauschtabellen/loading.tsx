import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves exchange tables. */
export default function AustauschtabellenLoading() {
  return <TablePageSkeleton rows={10} />
}
