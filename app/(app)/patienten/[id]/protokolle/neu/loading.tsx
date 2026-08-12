import { FormPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the new-protocol form. */
export default function ProtokollNeuLoading() {
  return <FormPageSkeleton sections={3} />
}
