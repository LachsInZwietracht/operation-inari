import { FormPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the new-patient form. */
export default function PatientNeuLoading() {
  return <FormPageSkeleton sections={4} />
}
