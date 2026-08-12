import { DashboardSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the practice overview. */
export default function DashboardLoading() {
  return <DashboardSkeleton />
}
