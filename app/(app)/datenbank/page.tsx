import { GitCompareArrows, Lock, PlugZap } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchCurrentMembership, getCurrentUser } from "@/lib/auth/access"
import { ADMIN_ROLES } from "@/lib/auth/rbac"
import { fetchOrganizationDisabledSourceIds } from "@/lib/data/data-source-activations"
import { fetchDataSources } from "@/lib/data/data-sources"
import { canAccessDataSource } from "@/lib/data/entitlements"
import { FOOD_SOURCES } from "@/lib/data/food-sources"
import { createClient } from "@/lib/supabase/server"
import type { AppRole, FoodSourceId } from "@/lib/types"

// Sources the foods browser can scope to — mirrors ACTIVE_FOOD_BROWSER_SOURCE_IDS
// in the foods browser so the governance view and the working selector agree.
const CONNECTABLE_SOURCE_IDS: FoodSourceId[] = ["bls", "sfk", "off", "custom"]
import { ConnectedDatabases, type ConnectedDatabase } from "./connected-databases"

// Resolves the current user's org role without creating an organization as a
// side effect (so a read-only page render never mutates membership state).
async function fetchCurrentRole(): Promise<AppRole | null> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser(supabase)
    if (!user) return null
    const membership = await fetchCurrentMembership(supabase, user.id)
    return membership?.role ?? null
  } catch {
    return null
  }
}

export default async function DatenbankPage() {
  const [
    { sources, error },
    disabledSourceIds,
    role,
  ] = await Promise.all([
    fetchDataSources(),
    fetchOrganizationDisabledSourceIds(),
    fetchCurrentRole(),
  ])

  const disabled = new Set(disabledSourceIds)
  const canManage = role != null && ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])

  const connectedDatabases: ConnectedDatabase[] = CONNECTABLE_SOURCE_IDS.flatMap((id) => {
    const meta = FOOD_SOURCES.find((source) => source.id === id)
    if (!meta) return []
    return [
      {
        id,
        name: meta.name,
        coverage: meta.coverage,
        description: meta.description,
        entitled: canAccessDataSource(id),
        enabled: !disabled.has(id),
        catalog: sources.find((source) => source.id === id) ?? null,
      },
    ]
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datenbankstatus"
        description="Quellen, Versionen und Datentiefe der verbundenen Lebensmitteldatenbanken"
        helpText="Diese Ansicht zeigt reale Datenbank-Metadaten aus Supabase. Versionen, Importzeitpunkte und Datentiefe kommen aus `data_sources`."
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <PlugZap className="h-5 w-5 text-muted-foreground" />
              Verbundene Datenbanken
            </CardTitle>
          </div>
          <CardDescription>
            Diese Quellen stehen in der Lebensmittelsuche zur Auswahl. Klicken Sie auf eine Quelle,
            um Versionen, Importzeitpunkte, Datentiefe und Lizenz zu sehen und die Datenbank für die
            Organisation zu aktivieren oder zu deaktivieren. Gesperrte Quellen werden über den Tarif
            freigeschaltet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectedDatabases databases={connectedDatabases} canManage={canManage} />
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Quellenkatalog derzeit nicht verfuegbar</CardTitle>
            <CardDescription>
              Die Seite faellt bewusst nicht auf statische Release-Notizen zurueck, wenn Supabase-Daten fehlen.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : null}

      <Card className="opacity-90">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5 text-muted-foreground" />
              Naehrstoffvergleich
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" />
              Bald verfuegbar
            </Badge>
          </div>
          <CardDescription>
            Zwei Lebensmittel (auch quellenuebergreifend) vergleichen. Abweichungen ueber 10% werden farblich hervorgehoben.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
            <div className="rounded-full bg-muted p-3">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Diese Funktion ist noch nicht freigeschaltet.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Der Naehrstoffvergleich wird in einer kommenden Version verfuegbar sein.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
