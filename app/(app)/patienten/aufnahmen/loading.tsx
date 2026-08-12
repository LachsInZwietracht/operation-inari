import { ListPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves open intakes. */
export default function AufnahmenLoading() {
  return <ListPageSkeleton rows={10} />
}
