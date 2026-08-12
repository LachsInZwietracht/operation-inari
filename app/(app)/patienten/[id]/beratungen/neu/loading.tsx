import { FormPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the new-session form. */
export default function BeratungNeuLoading() {
  return <FormPageSkeleton sections={3} />
}
