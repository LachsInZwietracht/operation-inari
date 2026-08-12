import { DetailPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves a counseling session. */
export default function BeratungLoading() {
  return <DetailPageSkeleton tabs={false} />
}
