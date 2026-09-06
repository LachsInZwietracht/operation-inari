"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { addDays, format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { ArrowLeft, Check, ShoppingBasket, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatShoppingAmount, type ShoppingList, type ShoppingListItem } from "@/lib/shopping-list"

function itemKey(item: ShoppingListItem) { return `${item.foodId}:${item.totalGrams}` }

export function ClientShoppingList({ userId, from, to, current, result }: {
  userId: string; from: string; to: string; current: boolean
  result: { list: ShoppingList; dates: string[] } | null
}) {
  const router = useRouter()
  const [checked, setChecked] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [localOnly, setLocalOnly] = useState(false)
  const storageKey = `client-shopping:v1:${userId}:${from}`
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]")
      // Hydrate browser-only storage after the server render; keep controls disabled until ready.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setChecked(saved.filter((key): key is string => typeof key === "string"))
    } catch { setLocalOnly(true) }
    setReady(true)
  }, [storageKey])

  const list = result?.list
  const items = list?.groups.flatMap(group => group.items) ?? []
  const done = items.filter(item => checked.includes(itemKey(item)))
  const remaining = items.length - done.length
  const range = `${format(parseISO(from), "d. MMM", { locale: de })} – ${format(parseISO(to), "d. MMM yyyy", { locale: de })}`
  const missingDays = Array.from({ length: 7 }, (_, i) => addDays(parseISO(from), i)).filter(date => !result?.dates.includes(format(date, "yyyy-MM-dd")))

  function toggle(item: ShoppingListItem) {
    const key = itemKey(item)
    const next = checked.includes(key) ? checked.filter(value => value !== key) : [...checked, key]
    setChecked(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) }
    catch { setLocalOnly(true) }
  }

  async function share() {
    const text = [`Einkaufsliste · ${range}`, result?.dates.length !== 7 ? `Für ${result?.dates.length ?? 0} von 7 Tagen mit Plan.` : "", list?.missing.length ? "Achtung: Einige Zutaten fehlen in dieser Liste." : "", ...list!.groups.flatMap(group => {
      const open = group.items.filter(item => !checked.includes(itemKey(item)))
      return open.length ? ["", group.categoryLabel, ...open.map(item => `${formatShoppingAmount(item.totalGrams)} ${item.name}`)] : []
    })].filter(line => line !== undefined).join("\n")
    try {
      if (navigator.share) await navigator.share({ title: "Meine Einkaufsliste", text })
      else { await navigator.clipboard.writeText(text); toast.success("Offene Zutaten kopiert.") }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) toast.error("Teilen nicht möglich. Bitte versuche es erneut.")
    }
  }

  function row(item: ShoppingListItem, completed = false) {
    return <li key={item.foodId} className="px-4">
      <div className="flex items-start gap-3 py-3">
        <button type="button" role="checkbox" aria-checked={completed} aria-label={`${item.name}, ${formatShoppingAmount(item.totalGrams)}`} disabled={!ready}
          onClick={() => toggle(item)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary">
          <span className={cn("flex size-6 items-center justify-center rounded-full border-2 border-muted-foreground/40", completed && "border-primary bg-primary text-primary-foreground")}>
            {completed && <Check className="size-4" />}
          </span>
        </button>
        <div className="min-w-0 flex-1 pt-2">
          <button type="button" onClick={() => toggle(item)} disabled={!ready} tabIndex={-1} className="flex w-full items-baseline justify-between gap-3 text-left">
            <span className={cn("break-words font-medium", completed && "text-muted-foreground line-through")}>{item.name}</span>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatShoppingAmount(item.totalGrams)}</span>
          </button>
          {!completed && <details className="mt-1 text-xs text-muted-foreground">
            <summary className="w-fit cursor-pointer py-2">Wofür brauche ich das?</summary>
            <ul className="space-y-2 pb-2">{item.sources.map((source, index) => <li key={index}>
              {format(parseISO(source.planDate), "EEE", { locale: de })} · {source.viaRecipeName ?? "Im Tagesplan"} · {formatShoppingAmount(source.grams)}
            </li>)}</ul>
          </details>}
        </div>
      </div>
    </li>
  }

  return <div className="space-y-6 pb-4">
    <Link href="/klient/plan" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary"><ArrowLeft className="size-4" /> Mein Plan</Link>
    <header>
      <p className="mb-2 text-sm font-medium text-muted-foreground">Deine Woche, gut vorbereitet</p>
      <h1 className="text-3xl font-semibold tracking-tight">Einkaufsliste</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Alles aus deinem Plan. Gleiche Zutaten sind schon zusammengezählt.</p>
    </header>
    <div>
      <nav aria-label="Einkaufswoche" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {[{ label: "Diese Woche", active: current, href: "?woche=diese" }, { label: "Nächste Woche", active: !current, href: "?woche=naechste" }].map(week =>
          <Link key={week.label} href={week.href} aria-current={week.active ? "page" : undefined} className={cn("rounded-lg px-3 py-3 text-center text-sm font-medium", week.active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{week.label}</Link>)}
      </nav>
      <p className="mt-3 text-center text-sm text-muted-foreground">{range}</p>
    </div>

    {!result ? <div role="alert" className="rounded-2xl border bg-background p-6">
      <h2 className="font-semibold">Deine Liste konnte nicht geladen werden.</h2>
      <p className="mt-2 text-sm text-muted-foreground">Bitte versuche es noch einmal.</p>
      <Button className="mt-4" onClick={() => router.refresh()}>Erneut versuchen</Button>
    </div> : items.length === 0 && list?.missing.length === 0 ? <div className="rounded-3xl border bg-background px-6 py-10 text-center">
      <ShoppingBasket className="mx-auto mb-4 size-9 text-primary" />
      <h2 className="text-lg font-semibold">Deine Woche ist noch offen</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Sobald deine Ernährungsberatung Mahlzeiten für diese Woche freigibt, findest du hier deine Zutaten.</p>
      {!current && <Button asChild variant="outline" className="mt-5"><Link href="?woche=diese">Diese Woche ansehen</Link></Button>}
    </div> : <>
      {(missingDays.length > 0 || !!list?.missing.length) && <aside className="rounded-2xl bg-muted/70 p-4 text-sm leading-relaxed">
        <p className="font-medium">{result.dates.length} von 7 Tagen mit Plan</p>
        {missingDays.length > 0 && <p className="mt-1 text-muted-foreground">Noch ohne Mahlzeiten: {missingDays.map(date => format(date, "EEE", { locale: de })).join(", ")}. Dafür sind keine Zutaten enthalten.</p>}
        {!!list?.missing.length && <p className="mt-2 font-medium">Die Liste ist unvollständig: Einige Zutaten oder Rezepte sind nicht verfügbar. Bitte kläre die fehlenden Angaben mit deiner Ernährungsberatung.</p>}
      </aside>}
      {items.length > 0 && <>
        <div className="flex items-center justify-between gap-3">
          <div aria-live="polite"><h2 className="text-xl font-semibold tracking-tight">{remaining ? `${remaining} noch einzukaufen` : "Alles erledigt"}</h2><p className="mt-1 text-xs text-muted-foreground">{remaining ? "Schon zu Hause? Einfach abhaken." : "Dein Einkauf ist vorbereitet."}</p></div>
          <Button variant="outline" size="icon" aria-label="Offene Zutaten teilen" disabled={!remaining || !ready} onClick={() => void share()}><Share2 className="size-4" /></Button>
        </div>
        {list!.groups.map(group => {
          const open = group.items.filter(item => !checked.includes(itemKey(item)))
          if (!open.length) return null
          return <section key={group.categoryId} aria-label={group.categoryLabel}>
            <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">{group.categoryLabel}</h3>
            <ul className="divide-y rounded-2xl border bg-background">{open.map(item => row(item))}</ul>
          </section>
        })}
        {done.length > 0 && <details className="rounded-2xl border bg-background" open={remaining === 0 ? true : undefined}>
          <summary className="cursor-pointer p-4 text-sm font-medium">Erledigt · {done.length}</summary>
          <ul className="divide-y border-t">{done.map(item => row(item, true))}</ul>
        </details>}
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">{localOnly ? "Abhakungen können gerade nicht gespeichert werden und gelten nur bis zum Verlassen dieser Seite." : "Abhakungen werden auf diesem Gerät gespeichert. Bei geänderten Mengen erscheint die Zutat wieder offen."}</p>
      </>}
    </>}
  </div>
}
