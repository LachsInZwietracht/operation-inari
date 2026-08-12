import { DetailPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves a patient record. */
export default function PatientDetailLoading() {
  return <DetailPageSkeleton />
}
