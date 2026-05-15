"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Apple,
  ChefHat,
  CalendarDays,
  Sigma,
  ShoppingBasket,
  BookMarked,
  BarChart3,
  Users,
  ArrowLeftRight,
  Database,
  Scale,
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
  PlugZap,
  ShieldCheck,
  Gauge,
  Ruler,
  Lock,
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
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Übersicht",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, route: "/dashboard" },
      { label: "Datenbank", icon: Database, route: "/datenbank" },
    ],
  },
  {
    title: "Ernährung",
    items: [
      { label: "Lebensmittel", icon: Apple, route: "/lebensmittel" },
      { label: "Vergleich", icon: Scale, route: "/lebensmittel/vergleichen" },
      { label: "Rezepte", icon: ChefHat, route: "/rezepte" },
      { label: "Ernährungsplan", icon: CalendarDays, route: "/ernaehrungsplan" },
      { label: "Plan-Bibliothek", icon: BookMarked, route: "/ernaehrungsplan/bibliothek" },
      { label: "Plan-Vergleich", icon: Sigma, route: "/ernaehrungsplan/vergleich" },
      { label: "Einkaufsliste", icon: ShoppingBasket, route: "/ernaehrungsplan/einkaufsliste" },
      { label: "Referenzwerte", icon: Ruler, route: "/referenzwerte" },
      { label: "Austauschtabellen", icon: ArrowLeftRight, route: "/austauschtabellen" },
    ],
  },
  {
    title: "Patienten",
    items: [
      { label: "Patienten", icon: Users, route: "/patienten" },
      { label: "Berichte", icon: BarChart3, route: "/berichte" },
    ],
  },
  {
    title: "Institution",
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
    items: [
      { label: "Termine", icon: CalendarClock, route: "/termine" },
      { label: "Abrechnung", icon: Receipt, route: "/abrechnung" },
      { label: "Praxis-Statistiken", icon: LineChart, route: "/praxis-statistiken" },
    ],
  },
  {
    title: "Wissen & Technik",
    items: [
      { label: "Wissen", icon: BookOpen, route: "/wissen" },
      { label: "API & Export", icon: Network, route: "/api-export" },
      { label: "Integrationen", icon: PlugZap, route: "/admin/integrationen" },
      { label: "Leistung", icon: Gauge, route: "/leistung" },
      { label: "Tarife", icon: ShieldCheck, route: "/admin/tarife" },
      { label: "Admin & Nutzer", icon: ShieldCheck, route: "/admin/users" },
    ],
  },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  canAccessInstitution?: boolean
}

const INSTITUTION_LOCKED_LABEL = "Institution-Zugriff erforderlich"

export function AppSidebar({ canAccessInstitution = true, ...props }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" prefetch={false}>
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-sm font-bold">
                  I
                </div>
                <span className="truncate text-lg font-semibold">Inari</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.route || pathname.startsWith(`${item.route}/`)
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
        ))}
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
