import { Fragment } from "react"
import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export interface BreadcrumbTrailItem {
  label: string
  /** Omit on the last item — the current page is never a link. */
  href?: string
}

interface PageBreadcrumbProps {
  items: BreadcrumbTrailItem[]
  /** Actions pinned to the right of the header row, e.g. a primary button. */
  children?: React.ReactNode
}

/**
 * The app-wide page header row: breadcrumb left, actions right.
 *
 * Every list page in the app gets this, with identical markup and identical
 * spacing — a practitioner moving between Aufnahmen, Rezepte and Lebensmittel
 * should never have to re-find where they are. The 46px height and 18px inset
 * come from the patient-frontend handoff and are shared with
 * {@link ListFilterBar}, which sits directly beneath it.
 */
export function PageBreadcrumb({ items, children }: PageBreadcrumbProps) {
  return (
    <div className="flex h-[46px] shrink-0 items-center justify-between gap-3 border-b px-[18px]">
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap gap-1.5 sm:gap-1.5">
          {items.map((item, index) => {
            const isLast = index === items.length - 1

            return (
              // The separator renders its own <li>, so it has to sit beside the
              // item rather than inside it — nesting them is invalid HTML and
              // breaks hydration.
              <Fragment key={`${item.label}-${index}`}>
                <BreadcrumbItem className="min-w-0">
                  {isLast ? (
                    // The trail's last item *is* the page's name, so it doubles
                    // as the h1. Without it the page would have no heading at
                    // all — the handoff replaces the old title block entirely.
                    // BreadcrumbPage is skipped here on purpose: it carries
                    // role="link", which would override the heading role.
                    <h1
                      aria-current="page"
                      className="truncate text-[13px] font-medium text-foreground"
                    >
                      {item.label}
                    </h1>
                  ) : !item.href ? (
                    <BreadcrumbPage className="truncate text-[13px] font-medium">
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        href={item.href}
                        prefetch={false}
                        className="truncate text-[13px] text-muted-foreground"
                      >
                        {item.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {isLast ? null : <BreadcrumbSeparator className="text-fg-4" />}
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  )
}
