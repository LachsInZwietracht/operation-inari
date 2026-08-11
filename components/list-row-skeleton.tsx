interface ListRowSkeletonProps {
  /** How many placeholder rows to draw. */
  rows?: number
  /** Row height in pixels — match the list this stands in for. */
  height?: number
}

/**
 * Placeholder rows while a list loads.
 *
 * Rows at the real row height rather than a spinner: the layout is already
 * correct when the data lands, so nothing jumps, and the practitioner can see
 * how much is coming before it arrives.
 */
export function ListRowSkeleton({ rows = 6, height = 44 }: ListRowSkeletonProps) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b px-[18px]"
          style={{ height }}
        >
          <span className="h-2.5 w-40 rounded-full bg-line-2" />
          <span className="ml-auto h-2.5 w-24 rounded-full bg-line-2" />
          <span className="h-2.5 w-20 rounded-full bg-line-2" />
        </div>
      ))}
    </div>
  )
}
