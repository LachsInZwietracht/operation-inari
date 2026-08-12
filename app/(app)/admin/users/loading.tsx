import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves members and their roles. */
export default function UsersLoading() {
  return <TablePageSkeleton rows={8} />
}
