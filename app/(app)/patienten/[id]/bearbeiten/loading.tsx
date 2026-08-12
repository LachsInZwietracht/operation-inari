import { FormPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the patient form. */
export default function PatientBearbeitenLoading() {
  return <FormPageSkeleton sections={4} />
}
