import type * as React from "react"
import {
  Apple,
  BookOpen,
  Boxes,
  CalendarClock,
  CalendarDays,
  ChefHat,
  Database,
  Factory,
  Flame,
  Hospital,
  LayoutDashboard,
  LineChart,
  Network,
  PieChart,
  Receipt,
  Ruler,
  ShieldCheck,
  ShieldCheck as ClipboardCheck,
  ShoppingBasket,
  Users,
} from "lucide-react"

export interface NavItem {
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  route: string
  requiresInstitutionAccess?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
  /** Visually de-emphasize this section while we focus on the MVP. */
  deEmphasized?: boolean
}

export const NAV_SECTIONS: NavSection[] = [
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
