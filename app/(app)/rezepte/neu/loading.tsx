import { FormPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the new-recipe form. */
export default function RezeptNeuLoading() {
  return <FormPageSkeleton sections={3} />
}
