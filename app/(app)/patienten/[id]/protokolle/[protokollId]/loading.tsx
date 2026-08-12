import { DetailPageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves a protocol. */
export default function ProtokollLoading() {
  return <DetailPageSkeleton tabs={false} />
}
