"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Check, Lock, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import type { DataSourceCatalogEntry } from "@/lib/data/data-sources"
import { formatDate, formatNumber } from "@/lib/format"
import type { FoodSourceId } from "@/lib/types"
import { setDataSourceActiveAction } from "./actions"

export interface ConnectedDatabase {
  id: FoodSourceId
  name: string
  coverage: string
  description: string
  /** Whether the tariff grants access to this source. */
  entitled: boolean
  /** Whether the organization has the source switched on (default true). */
  enabled: boolean
  catalog: DataSourceCatalogEntry | null
}

function StatusBadge({ entitled, enabled }: { entitled: boolean; enabled: boolean }) {
  if (!entitled) {
    return (
      <Badge variant="outline" className="shrink-0 gap-1">
        <Lock className="h-3 w-3" />
        Tarif
      </Badge>
    )
  }
  if (!enabled) {
    return (
      <Badge variant="secondary" className="shrink-0 gap-1">
        <X className="h-3 w-3" />
        Inaktiv
      </Badge>
    )
  }
  return (
    <Badge className="shrink-0 gap-1">
      <Check className="h-3 w-3" />
      Aktiv
    </Badge>
  )
}

export function ConnectedDatabases({
  databases,
  canManage,
}: {
  databases: ConnectedDatabase[]
  canManage: boolean
}) {
  const [selectedId, setSelectedId] = useState<FoodSourceId | null>(null)
  // Optimistic enabled overrides keyed by source id.
  const [enabledOverrides, setEnabledOverrides] = useState<Partial<Record<FoodSourceId, boolean>>>({})
  const [feedback, setFeedback] = useState<{ id: FoodSourceId; message: string; error: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  const resolveEnabled = (db: ConnectedDatabase) => enabledOverrides[db.id] ?? db.enabled
  const selected = databases.find((db) => db.id === selectedId) ?? null

  function handleToggle(db: ConnectedDatabase, nextEnabled: boolean) {
    setFeedback(null)
    setEnabledOverrides((prev) => ({ ...prev, [db.id]: nextEnabled }))
    startTransition(async () => {
      const result = await setDataSourceActiveAction({ sourceId: db.id, isActive: nextEnabled })
      if (result.status === "error") {
        // Roll back the optimistic value on failure.
        setEnabledOverrides((prev) => ({ ...prev, [db.id]: !nextEnabled }))
        setFeedback({ id: db.id, message: result.message ?? "Fehler.", error: true })
      } else {
        setFeedback({ id: db.id, message: result.message ?? "Gespeichert.", error: false })
      }
    })
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {databases.map((db) => {
          const enabled = resolveEnabled(db)
          return (
            <button
              key={db.id}
              type="button"
              onClick={() => setSelectedId(db.id)}
              className="rounded-lg border p-4 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{db.name}</p>
                  <p className="text-xs text-muted-foreground">{db.coverage}</p>
                </div>
                <StatusBadge entitled={db.entitled} enabled={enabled} />
              </div>
              <p className="mt-3 text-muted-foreground">{db.description}</p>
              <p className="mt-3 text-xs font-medium text-primary">Details ansehen</p>
            </button>
          )
        })}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.name}
                  {selected.catalog ? (
                    <Badge variant="outline">v{selected.catalog.version}</Badge>
                  ) : null}
                </DialogTitle>
                <DialogDescription>{selected.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge entitled={selected.entitled} enabled={resolveEnabled(selected)} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Abdeckung</span>
                  <span className="text-right">{selected.coverage}</span>
                </div>

                {selected.catalog ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Importiert</span>
                      <span>{formatDate(selected.catalog.importedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Datensaetze</span>
                      <span>
                        {selected.catalog.recordCount != null
                          ? formatNumber(selected.catalog.recordCount)
                          : "nicht hinterlegt"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Naehrstoffe</span>
                      <span>
                        {selected.catalog.nutrientCount != null
                          ? formatNumber(selected.catalog.nutrientCount)
                          : "nicht hinterlegt"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Lizenz</span>
                      <span className="text-right">{selected.catalog.license ?? "nicht hinterlegt"}</span>
                    </div>
                    {selected.catalog.url ? (
                      <a
                        className="inline-block text-primary underline-offset-4 hover:underline"
                        href={selected.catalog.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Quelle oeffnen
                      </a>
                    ) : null}
                  </>
                ) : (
                  <p className="rounded-md border border-dashed p-3 text-muted-foreground">
                    Fuer diese Quelle sind noch keine Katalog-Metadaten in `data_sources` hinterlegt.
                  </p>
                )}

                {/* Activation control */}
                {selected.entitled ? (
                  <div className="mt-2 flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">In der Lebensmittelsuche verwenden</p>
                      <p className="text-xs text-muted-foreground">
                        {canManage
                          ? "Deaktivierte Datenbanken erscheinen nicht mehr in der Suche."
                          : "Nur Owner und Administratoren koennen Datenbanken aktivieren oder deaktivieren."}
                      </p>
                      {feedback && feedback.id === selected.id ? (
                        <p className={`mt-1 text-xs ${feedback.error ? "text-destructive" : "text-muted-foreground"}`}>
                          {feedback.message}
                        </p>
                      ) : null}
                    </div>
                    <Switch
                      checked={resolveEnabled(selected)}
                      disabled={!canManage || isPending}
                      onCheckedChange={(checked) => handleToggle(selected, checked)}
                      aria-label="Datenbank aktivieren oder deaktivieren"
                    />
                  </div>
                ) : (
                  <Link
                    href="/admin/tarife"
                    className="inline-block text-primary underline-offset-4 hover:underline"
                  >
                    Im Tarif freischalten
                  </Link>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
