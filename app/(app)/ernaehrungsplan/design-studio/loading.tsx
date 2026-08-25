import { Skeleton } from "@/components/ui/skeleton"

/** Route-level skeleton while the design studio's client bundle loads. */
export default function DesignStudioLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-10 w-96 rounded-full" />
      <Skeleton className="h-[520px] w-full rounded-2xl" />
    </div>
  )
}
