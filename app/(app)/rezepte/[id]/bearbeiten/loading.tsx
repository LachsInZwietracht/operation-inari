import { FormPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves the recipe form. */
export default function RezeptBearbeitenLoading() {
  return <FormPageSkeleton sections={3} />
}
