"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BrandMark } from "@/components/brand-mark"
import { ModeSwitchButton } from "@/components/mode-switch-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { ENABLED_CLIENT_MODULES } from "@/lib/client-modules"
import { cn } from "@/lib/utils"

/**
 * Mobile-first shell for the client surface. Deliberately not the counselor
 * sidebar: different density, different navigation, no RBAC-gated sections.
 */
export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4">
        <BrandMark className="h-6 w-auto" />
        <span className="text-sm font-medium text-muted-foreground">Klient</span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <ModeSwitchButton target="counselor" size="sm" variant="ghost" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 p-4 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background">
        <div className="mx-auto flex max-w-2xl">
          {ENABLED_CLIENT_MODULES.map((item) => {
            // "/klient" is a prefix of every other route, so it only matches exactly.
            const isActive =
              item.route === "/klient" ? pathname === "/klient" : pathname.startsWith(item.route)
            const Icon = item.icon

            return (
              <Link
                key={item.id}
                href={item.route}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
