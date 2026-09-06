import { notFound, redirect } from "next/navigation"
import { addDays, format, startOfWeek } from "date-fns"
import { ClientShoppingList } from "@/components/client/client-shopping-list"
import { isClientModuleEnabled } from "@/lib/client-modules"
import { todayIsoDate } from "@/lib/client-mode"
import { fetchClientShoppingList } from "@/lib/data/client-shopping-list"
import { createClient } from "@/lib/supabase/server"
import { getVerifiedUser } from "@/lib/supabase/verified-user"

export const dynamic = "force-dynamic"

export default async function ShoppingPage({ searchParams }: { searchParams: Promise<{ woche?: string }> }) {
  if (!isClientModuleEnabled("plan")) notFound()
  const current = (await searchParams).woche === "diese"
  const monday = startOfWeek(new Date(`${todayIsoDate()}T12:00:00`), { weekStartsOn: 1 })
  const from = format(addDays(monday, current ? 0 : 7), "yyyy-MM-dd")
  const to = format(addDays(monday, current ? 6 : 13), "yyyy-MM-dd")
  const client = await createClient()
  const user = await getVerifiedUser(client)
  if (!user) redirect("/login")
  let result = null
  try { result = await fetchClientShoppingList(client, user.id, from, to) }
  catch (error) { console.error("Failed to load client shopping list", error) }
  return <ClientShoppingList key={`${user.id}:${from}`} userId={user.id} from={from} to={to} current={current} result={result} />
}
