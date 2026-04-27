"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/client"
import { useAuthContext } from "@/components/auth-provider"

export function UserNav() {
  const router = useRouter()
  const { user } = useAuthContext()

  if (!user) return null

  const firstName = (user.user_metadata?.first_name as string) ?? ""
  const lastName = (user.user_metadata?.last_name as string) ?? ""
  const email = user.email ?? ""
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U"

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Abgemeldet!")
    router.push("/login")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">
              {firstName} {lastName}
            </span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" side="top" align="start">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">
              {firstName} {lastName}
            </p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
