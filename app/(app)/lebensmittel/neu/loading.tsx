import { FormPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the new-food form. */
export default function LebensmittelNeuLoading() {
  return <FormPageSkeleton sections={3} />
}
