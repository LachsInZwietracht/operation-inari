import { Skeleton } from "@/components/ui/skeleton"

export default function ApplePlanLabLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="h-[68vh] w-full rounded-[28px]" />
    </div>
  )
}
