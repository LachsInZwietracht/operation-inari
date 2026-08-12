import { FormPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the calorie calculator. */
export default function KalorienrechnerLoading() {
  return <FormPageSkeleton sections={2} />
}
