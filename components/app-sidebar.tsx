"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Apple,
  ChefHat,
  CalendarDays,
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
  ShieldCheck,
  Gauge,
  Ruler,
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
      { label: "Menüpläne", icon: Factory, route: "/institution/menueplaene" },
      { label: "Produktion", icon: Boxes, route: "/institution/produktion" },
      { label: "Compliance", icon: ClipboardCheck, route: "/institution/compliance" },
      { label: "Krankenhaus", icon: Hospital, route: "/institution/krankenhaus" },
      { label: "Statistiken", icon: PieChart, route: "/institution/statistiken" },
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
      { label: "Leistung", icon: Gauge, route: "/leistung" },
      { label: "Tarife", icon: ShieldCheck, route: "/admin/tarife" },
      { label: "Admin & Nutzer", icon: ShieldCheck, route: "/admin/users" },
    ],
  },
]

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
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

                  return (
                    <SidebarMenuItem key={item.route}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link href={item.route}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
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
