import { cn } from "@/lib/utils"

interface ListPageShellProps {
  /** The {@link PageBreadcrumb} row. */
  header: React.ReactNode
  /** The {@link ListFilterBar} row. */
  filterBar?: React.ReactNode
  /**
   * Set for views that need their own inset (Zeitachse, Board, Dashboard). The
   * grouped list runs edge to edge instead, so it stays false by default.
   */
  padded?: boolean
  children: React.ReactNode
}

/**
 * Frame for a full-bleed list page: header row, filter bar, then content.
 *
 * The app shell pads `<main>` with `p-4 md:p-6`, which is right for form and
 * detail pages but wrong here — the handoff's header rules and list rows have to
 * meet the viewport edge. The negative margin cancels exactly that padding, so
 * the two values are a pair: change one in `app/(app)/layout.tsx` and this must
 * follow.
 */
export function ListPageShell({
  header,
  filterBar,
  padded = false,
  children,
}: ListPageShellProps) {
  return (
    <div className="-m-4 flex min-h-0 flex-col md:-m-6">
      {header}
      {filterBar}
      <div className={cn("min-w-0 flex-1", padded && "p-[22px]")}>{children}</div>
    </div>
  )
}
