import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route-level skeletons, one per page shape.
 *
 * These exist for two reasons, and the second is the less obvious one:
 *
 * 1. A click paints immediately instead of leaving the previous screen frozen
 *    while the server works.
 * 2. Next.js only prefetches a *dynamic* route as far as its nearest
 *    `loading.tsx`. Without one, hovering a link warms up nothing at all, so
 *    these files are what makes prefetching do any work on this app — every
 *    route here is dynamic, because the app shell resolves the session.
 *
 * Match the shape of the real page rather than its exact pixels: the point is
 * that nothing jumps when the data lands.
 */

/**
 * Full-bleed list pages built on {@link ListPageShell} — Aufnahmen, Patienten.
 * The negative margin cancels `<main>`'s padding exactly as the shell does, so
 * the header rule and rows meet the viewport edge in both states.
 */
export function ListPageSkeleton({
  rows = 8,
  rowHeight = 44,
  padded = false,
  kpis = 0,
  sidePanel = false,
}: {
  rows?: number
  rowHeight?: number
  padded?: boolean
  /** Number of KPI cards above the list, as on the ongoing-care screen. */
  kpis?: number
  /** Reserve the right-hand attention column. */
  sidePanel?: boolean
}) {
  return (
    <div className="-m-4 flex min-h-0 flex-col md:-m-6">
      <div className="flex h-[46px] shrink-0 items-center gap-3 border-b px-[18px]">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="ml-auto h-7 w-28 rounded-md" />
        <Skeleton className="h-7 w-32 rounded-md" />
      </div>

      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-[18px]">
        <Skeleton className="h-6 w-44 rounded-md" />
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="ml-auto h-6 w-28 rounded-md" />
      </div>

      <div className={padded ? "flex flex-col gap-5 p-[22px]" : undefined}>
        {kpis > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: kpis }, (_, index) => (
              <Skeleton key={index} className="h-24 rounded-[10px]" />
            ))}
          </div>
        ) : null}

        <div
          className={
            sidePanel
              ? "grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"
              : undefined
          }
        >
          <div className="min-w-0">
            {Array.from({ length: rows }, (_, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 border-b ${padded ? "" : "px-[18px]"}`}
                style={{ height: rowHeight }}
              >
                <Skeleton className="h-2.5 w-44" />
                <Skeleton className="ml-auto h-2.5 w-24" />
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>

          {sidePanel ? (
            <div className="space-y-4">
              <Skeleton className="h-44 rounded-[10px]" />
              <Skeleton className="h-40 rounded-[10px]" />
              <Skeleton className="h-32 rounded-[10px]" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Pages that are a title, a filter row and a grid of cards. */
export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-9 w-44" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

/** Pages that are a title, some stat cards and a table. */
export function TablePageSkeleton({
  stats = 0,
  rows = 8,
}: {
  stats?: number
  rows?: number
}) {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />

      {stats > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: stats }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="rounded-xl border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="ml-auto h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Detail pages: heading, tab row, then a wide column beside a narrow one. */
export function DetailPageSkeleton({ tabs = true }: { tabs?: boolean }) {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />

      {tabs ? <Skeleton className="h-9 w-96 max-w-full rounded-md" /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/** Create/edit forms: heading, then stacked field groups. */
export function FormPageSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />

      {Array.from({ length: sections }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border p-5">
          <Skeleton className="h-4 w-40" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
          </div>
        </div>
      ))}

      <div className="flex gap-3">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
  )
}

/** The dashboard: a row of KPI cards, then a wide column beside a narrow one. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeadingSkeleton />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

function PageHeadingSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-80" />
    </div>
  )
}
