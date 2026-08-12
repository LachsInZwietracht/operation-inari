import { TablePageSkeleton } from "@/components/page-skeletons"

/** Route-level skeleton while the server resolves invoices and their totals. */
export default function AbrechnungLoading() {
  return <TablePageSkeleton stats={4} rows={8} />
}
