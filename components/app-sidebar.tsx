"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  Apple,
  ChefHat,
  CalendarDays,
  ShoppingBasket,
  Users,
  Database,
  Factory,
  Boxes,
  PieChart,
  Hospital,
  ShieldCheck as ClipboardCheck,
  CalendarClock,
  Receipt,
  LineChart,
  BookOpen,
  Network,
  ShieldCheck,
  Ruler,
  Lock,
  ChevronDown,
  Flame,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserNav } from "@/components/user-nav"

interface NavItem {
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  route: string
  requiresInstitutionAccess?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
  /** Visually de-emphasize this section while we focus on the MVP. */
  deEmphasized?: boolean
}

const NAV_SECTIONS: NavSection[] = [
  {
    // Patientenarbeit: der tägliche Beratungs-Workflow von Übersicht bis Plan.
    title: "Arbeitsbereich",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, route: "/dashboard" },
      { label: "Patienten", icon: Users, route: "/patienten" },
      { label: "Ernährungspläne", icon: CalendarDays, route: "/ernaehrungsplaene" },
      { label: "Datenbank", icon: Database, route: "/datenbank" },
    ],
  },
  {
    // Lebensmittel-Bibliothek: das Material, aus dem Pläne gebaut werden.
    title: "Küche",
    items: [
      { label: "Rezepte", icon: ChefHat, route: "/rezepte" },
      { label: "Lebensmittel", icon: Apple, route: "/lebensmittel/uebersicht" },
      { label: "Einkaufsliste", icon: ShoppingBasket, route: "/ernaehrungsplan/einkaufsliste" },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "Referenzwerte", icon: Ruler, route: "/referenzwerte" },
      { label: "Kalorienrechner", icon: Flame, route: "/kalorienrechner" },
    ],
  },
  {
    title: "Institution",
    deEmphasized: true,
    items: [
      { label: "Menüpläne", icon: Factory, route: "/institution/menueplaene", requiresInstitutionAccess: true },
      { label: "Produktion", icon: Boxes, route: "/institution/produktion", requiresInstitutionAccess: true },
      { label: "Compliance", icon: ClipboardCheck, route: "/institution/compliance", requiresInstitutionAccess: true },
      { label: "Krankenhaus", icon: Hospital, route: "/institution/krankenhaus", requiresInstitutionAccess: true },
      { label: "Statistiken", icon: PieChart, route: "/institution/statistiken", requiresInstitutionAccess: true },
    ],
  },
  {
    title: "Praxis",
    deEmphasized: true,
    items: [
      { label: "Termine", icon: CalendarClock, route: "/termine" },
      { label: "Abrechnung", icon: Receipt, route: "/abrechnung" },
      { label: "Praxis-Statistiken", icon: LineChart, route: "/praxis-statistiken" },
    ],
  },
  {
    title: "Wissen & Technik",
    deEmphasized: true,
    items: [
      { label: "Wissen", icon: BookOpen, route: "/wissen" },
      { label: "API & Export", icon: Network, route: "/api-export" },
      { label: "Tarife", icon: ShieldCheck, route: "/admin/tarife" },
      { label: "Admin & Nutzer", icon: ShieldCheck, route: "/admin/users" },
    ],
  },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  canAccessInstitution?: boolean
}

const INSTITUTION_LOCKED_LABEL = "Institution-Zugriff erforderlich"

const PRIMARY_SECTIONS = NAV_SECTIONS.filter((section) => !section.deEmphasized)
const SECONDARY_SECTIONS = NAV_SECTIONS.filter((section) => section.deEmphasized)

export function AppSidebar({ canAccessInstitution = true, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  const isItemActive = (route: string) =>
    pathname === route || pathname.startsWith(`${route}/`)

  // Keep secondary sections visible whenever the current page lives in one of them.
  const activeInSecondary = SECONDARY_SECTIONS.some((section) =>
    section.items.some((item) => isItemActive(item.route))
  )
  const secondaryExpanded = showMore || activeInSecondary

  const renderSection = (section: NavSection) => (
    <SidebarGroup key={section.title}>
      <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {section.items.map((item) => {
            const isActive = isItemActive(item.route)
            const isLocked = item.requiresInstitutionAccess && !canAccessInstitution

            return (
              <SidebarMenuItem key={item.route}>
                {isLocked ? (
                  <SidebarMenuButton
                    aria-disabled="true"
                    aria-label={`${item.label}: ${INSTITUTION_LOCKED_LABEL}`}
                    className="pointer-events-auto cursor-not-allowed text-sidebar-foreground/55 hover:bg-transparent hover:text-sidebar-foreground/55"
                    title={INSTITUTION_LOCKED_LABEL}
                    type="button"
                    tooltip={`${item.label} gesperrt`}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                    <Lock className="ml-auto opacity-70 group-data-[collapsible=icon]:hidden" aria-hidden="true" />
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                    <Link href={item.route} prefetch={false}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" prefetch={false}>
                <span
                  className="flex aspect-square size-9 items-center justify-center rounded-[11px] p-1.5"
                  style={{
                    background: "linear-gradient(150deg, #46d896, #33b87b)",
                    boxShadow: "0 6px 16px rgba(62, 207, 142, 0.32)",
                  }}
                >
                  <BrandMark className="size-full" variant="black" priority />
                </span>
                <span className="grid leading-tight">
                  <span className="truncate text-[18px] font-extrabold tracking-tight">Inari</span>
                  <span className="truncate text-[10px] font-bold tracking-[0.14em] text-sidebar-foreground/70">
                    ERNÄHRUNGSPRAXIS
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {PRIMARY_SECTIONS.map(renderSection)}

        {SECONDARY_SECTIONS.length > 0 && (
          <>
            <SidebarGroup className="py-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      onClick={() => setShowMore((prev) => !prev)}
                      aria-expanded={secondaryExpanded}
                      className="text-sidebar-foreground/60"
                      tooltip={secondaryExpanded ? "Weniger anzeigen" : "Mehr anzeigen"}
                    >
                      <ChevronDown
                        className={`transition-transform ${secondaryExpanded ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                      <span>{secondaryExpanded ? "Weniger anzeigen" : "Mehr anzeigen"}</span>
                      {!secondaryExpanded && (
                        <span className="ml-auto flex items-center gap-1 text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
                          Demnächst
                          <Lock className="size-3" aria-hidden="true" />
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {secondaryExpanded && SECONDARY_SECTIONS.map(renderSection)}
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <UserNav />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
