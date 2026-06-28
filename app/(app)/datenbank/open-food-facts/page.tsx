import Link from "next/link"
import { AlertTriangle, CheckCircle2, Database, ExternalLink, Search, ShieldAlert } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireRole } from "@/lib/auth/access"
import { ADMIN_ROLES } from "@/lib/auth/rbac"
import { formatDate, formatNumber } from "@/lib/format"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { removeOpenFoodFactsFoodAction } from "../actions"

type OffReviewStatus = "all" | "promoted" | "validated" | "blocked"

type OffStagingRow = {
  barcode: string
  product_name: string | null
  brands: string | null
  categories: string | null
  countries_tags: string[] | null
  nutriments: Record<string, number> | null
  data_quality_errors: { score?: number; issues?: string[] } | null
  imported_at: string
  validated: boolean
  promoted: boolean
  validation_errors: string[] | null
  source_url: string | null
  data_quality_score: number | null
}

type OffFoodRow = {
  id: string
  source_food_id: string
}

const PAGE_SIZE = 50

const STATUS_LABELS: Record<OffReviewStatus, string> = {
  all: "Alle",
  promoted: "Freigegeben",
  validated: "Validiert",
  blocked: "Blockiert",
}

function normalizeStatus(value: string | undefined): OffReviewStatus {
  if (value === "promoted" || value === "validated" || value === "blocked") return value
  return "all"
}

function normalizePage(value: string | undefined) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function getIssues(row: OffStagingRow) {
  return [
    ...(row.validation_errors ?? []),
    ...(Array.isArray(row.data_quality_errors?.issues) ? row.data_quality_errors.issues : []),
  ]
}

function getDecisionReason(row: OffStagingRow) {
  const blockingReasons = row.validation_errors ?? []
  const warnings = Array.isArray(row.data_quality_errors?.issues) ? row.data_quality_errors.issues : []

  if (row.promoted) {
    return warnings.length > 0
      ? `Freigegeben mit Warnung: ${warnings[0]}`
      : "Freigegeben: Pflichtwerte und Plausibilitaetschecks bestanden."
  }

  if (row.validated) {
    return warnings.length > 0
      ? `Validiert mit Warnung: ${warnings[0]}`
      : "Validiert, aber noch nicht sichtbar verknuepft."
  }

  return blockingReasons[0] ?? warnings[0] ?? "Blockiert: Qualitaetsregeln nicht bestanden."
}

function getNutrient(nutriments: Record<string, number> | null, key: string) {
  const value = nutriments?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function formatNutrient(value: number | null, unit: string) {
  if (value === null) return "n. e."
  return `${formatNumber(Math.round(value * 10) / 10)} ${unit}`
}

function statusBadge(row: OffStagingRow) {
  if (row.promoted) {
    return (
      <Badge className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Freigegeben
      </Badge>
    )
  }
  if (row.validated) {
    return <Badge variant="secondary">Validiert</Badge>
  }
  return (
    <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
      <AlertTriangle className="h-3 w-3" />
      Blockiert
    </Badge>
  )
}

function filterHref(status: OffReviewStatus, q: string) {
  const params = new URLSearchParams()
  if (status !== "all") params.set("status", status)
  if (q) params.set("q", q)
  return `/datenbank/open-food-facts${params.size > 0 ? `?${params.toString()}` : ""}`
}

async function fetchOffReviewData({
  status,
  q,
  page,
}: {
  status: OffReviewStatus
  q: string
  page: number
}) {
  const client = await createServiceClient()
  const offset = (page - 1) * PAGE_SIZE

  let query = client
    .from("off_staging")
    .select(
      "barcode,product_name,brands,categories,countries_tags,nutriments,data_quality_errors,imported_at,validated,promoted,validation_errors,source_url,data_quality_score",
      { count: "exact" },
    )

  if (status === "promoted") query = query.eq("promoted", true)
  if (status === "validated") query = query.eq("validated", true)
  if (status === "blocked") query = query.eq("validated", false)
  if (q) {
    const escaped = q.replace(/[%_]/g, "\\$&")
    query = query.or(`product_name.ilike.%${escaped}%,brands.ilike.%${escaped}%,barcode.ilike.%${escaped}%`)
  }

  const { data, error, count } = await query
    .order("data_quality_score", { ascending: false, nullsFirst: false })
    .order("imported_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as OffStagingRow[]
  const barcodes = rows.map((row) => row.barcode)
  const foodIds = new Map<string, string>()

  if (barcodes.length > 0) {
    const { data: foods, error: foodsError } = await client
      .from("foods")
      .select("id,source_food_id")
      .eq("data_source_id", "off")
      .in("source_food_id", barcodes)

    if (foodsError) throw new Error(foodsError.message)
    for (const food of (foods ?? []) as OffFoodRow[]) {
      foodIds.set(food.source_food_id, food.id)
    }
  }

  const [
    { count: totalCount },
    { count: promotedCount },
    { count: validatedCount },
    { count: blockedCount },
  ] = await Promise.all([
    client.from("off_staging").select("barcode", { count: "exact", head: true }),
    client.from("off_staging").select("barcode", { count: "exact", head: true }).eq("promoted", true),
    client.from("off_staging").select("barcode", { count: "exact", head: true }).eq("validated", true),
    client.from("off_staging").select("barcode", { count: "exact", head: true }).eq("validated", false),
  ])

  return {
    rows,
    foodIds,
    totalMatches: count ?? 0,
    metrics: {
      total: totalCount ?? 0,
      promoted: promotedCount ?? 0,
      validated: validatedCount ?? 0,
      blocked: blockedCount ?? 0,
    },
  }
}

export default async function OpenFoodFactsReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const params = await searchParams
  const status = normalizeStatus(params.status)
  const q = (params.q ?? "").trim()
  const page = normalizePage(params.page)

  await requireRole(ADMIN_ROLES, await createClient())
  const { rows, foodIds, totalMatches, metrics } = await fetchOffReviewData({ status, q, page })
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Open Food Facts Review"
        description="Interne Pruefansicht fuer importierte Open-Food-Facts-Produkte"
        helpText="Diese Ansicht ist fuer die Datenqualitaetskontrolle gedacht. Sie ist keine finale Nutzerfunktion."
      />

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Interne Kontrollansicht</AlertTitle>
        <AlertDescription>
          Open Food Facts bleibt eine separate Quelle. Diese Seite hilft beim Pruefen, bevor groessere Mengen in klinische Workflows aufgenommen werden.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Staging</CardDescription>
            <CardTitle>{formatNumber(metrics.total)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Freigegeben</CardDescription>
            <CardTitle>{formatNumber(metrics.promoted)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Validiert</CardDescription>
            <CardTitle>{formatNumber(metrics.validated)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Blockiert</CardDescription>
            <CardTitle>{formatNumber(metrics.blocked)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            Pruefliste
          </CardTitle>
          <CardDescription>
            {formatNumber(totalMatches)} Treffer fuer {STATUS_LABELS[status].toLowerCase()} Eintraege
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABELS) as OffReviewStatus[]).map((key) => (
                <Button key={key} variant={status === key ? "default" : "outline"} size="sm" asChild>
                  <Link href={filterHref(key, q)}>{STATUS_LABELS[key]}</Link>
                </Button>
              ))}
            </div>

            <form className="flex w-full gap-2 lg:max-w-md">
              {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input name="q" defaultValue={q} placeholder="Name, Marke oder Barcode" className="pl-9" />
              </div>
              <Button type="submit" variant="outline">Suchen</Button>
            </form>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-64">Produkt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Qualitaet</TableHead>
                  <TableHead>Naehrwerte / 100 g</TableHead>
                  <TableHead className="min-w-80">Entscheidung</TableHead>
                  <TableHead>Import</TableHead>
                  <TableHead>Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Keine Open-Food-Facts-Eintraege fuer diesen Filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const issues = getIssues(row)
                    const foodId = foodIds.get(row.barcode)
                    return (
                      <TableRow key={row.barcode}>
                        <TableCell className="align-top">
                          <div className="space-y-1">
                            <p className="font-medium">{row.product_name ?? "Ohne Namen"}</p>
                            <p className="text-sm text-muted-foreground">{row.brands || "Ohne Marke"}</p>
                            <p className="font-mono text-xs text-muted-foreground">{row.barcode}</p>
                            {row.categories ? (
                              <p className="max-w-md truncate text-xs text-muted-foreground">{row.categories}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">{statusBadge(row)}</TableCell>
                        <TableCell className="align-top">
                          {row.data_quality_score != null ? `${formatNumber(row.data_quality_score)} / 100` : "n. e."}
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          <div className="grid min-w-48 grid-cols-2 gap-x-4 gap-y-1">
                            <span className="text-muted-foreground">kcal</span>
                            <span>{formatNutrient(getNutrient(row.nutriments, "energy_kcal_100g"), "kcal")}</span>
                            <span className="text-muted-foreground">Eiweiss</span>
                            <span>{formatNutrient(getNutrient(row.nutriments, "proteins_100g"), "g")}</span>
                            <span className="text-muted-foreground">Fett</span>
                            <span>{formatNutrient(getNutrient(row.nutriments, "fat_100g"), "g")}</span>
                            <span className="text-muted-foreground">KH</span>
                            <span>{formatNutrient(getNutrient(row.nutriments, "carbohydrates_100g"), "g")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <p className="max-w-md text-sm font-medium">{getDecisionReason(row)}</p>
                          {issues.length > 0 ? (
                            <ul className="mt-2 max-w-md space-y-1 text-xs text-muted-foreground">
                              {issues.slice(0, 4).map((issue) => (
                                <li key={issue}>{issue}</li>
                              ))}
                              {issues.length > 4 ? <li>+ {issues.length - 4} weitere</li> : null}
                            </ul>
                          ) : (
                            <span className="text-sm text-muted-foreground">Keine Warnungen</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-sm text-muted-foreground">
                          {formatDate(row.imported_at)}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-2">
                            {foodId ? (
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/lebensmittel/${foodId}`}>Food</Link>
                              </Button>
                            ) : null}
                            {foodId ? (
                              <form action={removeOpenFoodFactsFoodAction}>
                                <input type="hidden" name="barcode" value={row.barcode} />
                                <Button type="submit" variant="destructive" size="sm">
                                  Entfernen
                                </Button>
                              </form>
                            ) : null}
                            {row.source_url ? (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={row.source_url} rel="noreferrer" target="_blank">
                                  OFF
                                  <ExternalLink className="ml-1 h-3 w-3" />
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Seite {formatNumber(page)} von {formatNumber(totalPages)}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
                {page > 1 ? (
                  <Link href={`${filterHref(status, q)}${filterHref(status, q).includes("?") ? "&" : "?"}page=${page - 1}`}>
                    Zurueck
                  </Link>
                ) : (
                  <span>Zurueck</span>
                )}
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
                {page < totalPages ? (
                  <Link href={`${filterHref(status, q)}${filterHref(status, q).includes("?") ? "&" : "?"}page=${page + 1}`}>
                    Weiter
                  </Link>
                ) : (
                  <span>Weiter</span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
