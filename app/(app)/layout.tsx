import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { FoodSearchTrigger } from "@/components/food-search-command"
import { Separator } from "@/components/ui/separator"
import { PwaStatus } from "@/components/pwa-status"
import { FoodSearchProvider } from "@/components/foods-provider"
import { AuthProvider } from "@/components/auth-provider"

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <FoodSearchProvider foods={[]}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <FoodSearchTrigger />
              <div className="ml-auto">
                <PwaStatus />
              </div>
            </header>
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </FoodSearchProvider>
    </AuthProvider>
  )
}
