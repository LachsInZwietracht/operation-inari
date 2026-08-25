"use client"

import { Fragment, createContext, useContext, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { NAV_SECTIONS } from "@/lib/navigation"
import { cn } from "@/lib/utils"

export interface AppBreadcrumbItem {
  label: string
  /** Omitted on the last item, and on any step that has no page of its own. */
  href?: string
}

/**
 * Segments the sidebar does not name, because they are never a destination you
 * pick — you arrive at them from somewhere else.
 *
 * `linkable` is false where the path exists in the URL but not as a page, so
 * the crumb reads as a step rather than as a dead link.
 */
const SEGMENT_LABELS: Record<string, { label: string; linkable?: boolean }> = {
  neu: { label: "Neu" },
  bearbeiten: { label: "Bearbeiten" },
  beratungen: { label: "Beratungen" },
  uebersicht: { label: "Übersicht" },
  bibliothek: { label: "Bibliothek" },
  vergleich: { label: "Vergleich" },
  "design-studio": { label: "Design-Studio" },
  einkaufsliste: { label: "Einkaufsliste" },
  ernaehrungsplan: { label: "Ernährungsplan" },
  lebensmittel: { label: "Lebensmittel" },
  rezepte: { label: "Rezepte", linkable: true },
  patienten: { label: "Patienten", linkable: true },
  institution: { label: "Institution" },
  admin: { label: "Admin" },
  austauschtabellen: { label: "Austauschtabellen" },
  tarife: { label: "Tarife", linkable: true },
  users: { label: "Nutzer", linkable: true },
}

/** Route → sidebar label, so the trail and the sidebar always agree. */
const NAV_LABELS = new Map(
  NAV_SECTIONS.flatMap((section) => section.items.map((item) => [item.route, item.label] as const)),
)

/** UUIDs and numeric ids carry no meaning on screen. */
function isOpaqueId(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment) || /^\d+$/.test(segment)
}

/**
 * The trail for a path, from the sidebar's own labels plus the dictionary above.
 *
 * Opaque id segments are dropped rather than printed: a patient's record is
 * "Patienten › …", never "Patienten › 96ac7a0d-…". A page that knows the name
 * behind the id supplies the whole trail through {@link useAppBreadcrumb}.
 */
export function deriveBreadcrumb(pathname: string): AppBreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean)
  const items: AppBreadcrumbItem[] = []
  let path = ""

  for (const segment of segments) {
    path += `/${segment}`
    if (isOpaqueId(segment)) continue

    const navLabel = NAV_LABELS.get(path)
    if (navLabel) {
      items.push({ label: navLabel, href: path })
      continue
    }

    const known = SEGMENT_LABELS[segment]
    if (!known) continue
    items.push({ label: known.label, href: known.linkable ? path : undefined })
  }

  // A parent segment and its child can carry the same name — /lebensmittel and
  // /lebensmittel/uebersicht are both "Lebensmittel". The deeper one wins: it is
  // the one that actually has a page behind it.
  return items.filter((item, index) => index === items.length - 1 || item.label !== items[index + 1].label)
}

interface BreadcrumbStore {
  trail: AppBreadcrumbItem[] | null
  setTrail: (trail: AppBreadcrumbItem[] | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbStore | null>(null)

export function AppBreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [trail, setTrail] = useState<AppBreadcrumbItem[] | null>(null)
  const value = useMemo(() => ({ trail, setTrail }), [trail])
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>
}

/**
 * Names the current page in the app header, for routes whose URL cannot.
 *
 * A patient record is `/patienten/<uuid>`; only the page itself knows that the
 * uuid is Daniel Spallek. Call this with the finished trail and it replaces the
 * derived one until the page unmounts.
 */
export function useAppBreadcrumb(items: AppBreadcrumbItem[] | null) {
  const store = useContext(BreadcrumbContext)
  // The array is rebuilt on every render by most callers, so the effect keys off
  // the content rather than the identity — otherwise it would loop.
  const key = items ? JSON.stringify(items) : null

  useEffect(() => {
    if (!store) return
    store.setTrail(key ? (JSON.parse(key) as AppBreadcrumbItem[]) : null)
    return () => store.setTrail(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

/**
 * Where you are, in the app header beside the search.
 *
 * The app is deep enough that a screen alone does not say where it sits — a
 * patient record, a plan and a recipe all look like "a page with tabs". The
 * trail sits in the shell rather than in each page so it is in the same place
 * on every route, and it survives navigation without re-rendering the shell.
 */
export function AppBreadcrumb() {
  const pathname = usePathname()
  const store = useContext(BreadcrumbContext)
  const derived = useMemo(() => deriveBreadcrumb(pathname), [pathname])
  const items = store?.trail ?? derived

  if (items.length === 0) return null

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-1.5 sm:gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            // The separator is its own <li>, so it sits beside the item rather
            // than inside it — nesting them is invalid HTML. On a narrow screen
            // the ancestors drop out instead of truncating to three letters
            // each: the page's own name is the part that has to stay readable,
            // and the sidebar already says which area it belongs to.
            <Fragment key={`${item.label}-${index}`}>
              <BreadcrumbItem className={cn("min-w-0", !isLast && "hidden sm:flex")}>
                {isLast || !item.href ? (
                  <BreadcrumbPage className="truncate text-[13px] font-medium">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground truncate text-[13px] transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
              </BreadcrumbItem>
              {isLast ? null : (
                <BreadcrumbSeparator className="text-muted-foreground/50 hidden sm:block" />
              )}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
