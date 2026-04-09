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
    ],
  },
  {
    title: "Ernährung",
    items: [
      { label: "Lebensmittel", icon: Apple, route: "/lebensmittel" },
      { label: "Rezepte", icon: ChefHat, route: "/rezepte" },
      { label: "Ernährungsplan", icon: CalendarDays, route: "/ernaehrungsplan" },
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
                  P
                </div>
                <span className="truncate text-lg font-semibold">Prodi</span>
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
