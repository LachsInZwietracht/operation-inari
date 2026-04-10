"use client"

import { useState, useMemo } from "react"
import { BedDouble, AlertTriangle, Clock, CheckCircle2, Truck } from "lucide-react"
import { HOSPITAL_BEDS, DIETARY_ORDERS, DIET_FORMS } from "@/lib/mock-data"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import { PageHeader } from "@/components/page-header"
import { formatDate } from "@/lib/format"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DietFormCategory } from "@/lib/types/institution"
import type { MealSlotType } from "@/lib/types/meal-plan"
import type { DietaryOrder } from "@/lib/types/institution"

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const DIET_FORM_MAP = new Map(DIET_FORMS.map((d) => [d.id, d]))

const CATEGORY_COLORS: Record<DietFormCategory, string> = {
  standard: "bg-slate-100 text-slate-700 border-slate-200",
  diabetes: "bg-amber-100 text-amber-700 border-amber-200",
  renal: "bg-purple-100 text-purple-700 border-purple-200",
  allergen: "bg-red-100 text-red-700 border-red-200",
  consistency: "bg-blue-100 text-blue-700 border-blue-200",
  custom: "bg-gray-100 text-gray-700 border-gray-200",
}

const BED_BORDER_COLORS: Record<string, string> = {
  occupied: "border-l-green-500",
  empty: "border-l-gray-300",
  reserved: "border-l-yellow-400",
}

const ORDER_STATUS_CONFIG: Record<
  DietaryOrder["status"],
  { label: string; className: string }
> = {
  pending: {
    label: "Ausstehend",
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  confirmed: {
    label: "Bestätigt",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  delivered: {
    label: "Ausgeliefert",
    className: "bg-green-100 text-green-800 border-green-300",
  },
  cancelled: {
    label: "Storniert",
    className: "bg-gray-100 text-gray-600 border-gray-300",
  },
}

function getDietFormBadges(dietFormIds: string[]) {
  return dietFormIds.map((id) => {
    const form = DIET_FORM_MAP.get(id)
    if (!form) return null
    return (
      <Badge
        key={id}
        variant="outline"
        className={`text-xs ${CATEGORY_COLORS[form.category]}`}
      >
        {form.shortName}
      </Badge>
    )
  })
}

// ──────────────────────────────────────────────
// Meal slot filter options (subset relevant for hospital orders)
// ──────────────────────────────────────────────

const MEAL_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "alle", label: "Alle" },
  { value: "fruehstueck", label: "Frühstück" },
  { value: "mittagessen", label: "Mittagessen" },
  { value: "abendessen", label: "Abendessen" },
]

const STATUS_FILTER_OPTIONS: {
  value: string
  label: string
}[] = [
  { value: "alle", label: "Alle" },
  { value: "pending", label: "Ausstehend" },
  { value: "confirmed", label: "Bestätigt" },
  { value: "delivered", label: "Ausgeliefert" },
]

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default function KrankenhausPage() {
  const [orders, setOrders] = useState(DIETARY_ORDERS)
  const [mealFilter, setMealFilter] = useState("alle")
  const [statusFilter, setStatusFilter] = useState("alle")

  // KPI calculations
  const totalBeds = HOSPITAL_BEDS.length
  const occupiedBeds = HOSPITAL_BEDS.filter(
    (b) => b.status === "occupied"
  ).length
  const occupancyRate = Math.round((occupiedBeds / totalBeds) * 100)

  const pendingOrders = orders.filter((o) => o.status === "pending").length

  const activeDietFormIds = new Set(
    HOSPITAL_BEDS.filter((b) => b.status === "occupied").flatMap(
      (b) => b.dietFormIds
    )
  )

  // Group beds by station
  const bedsByStation = useMemo(() => {
    const map = new Map<string, typeof HOSPITAL_BEDS>()
    for (const bed of HOSPITAL_BEDS) {
      const list = map.get(bed.station) ?? []
      list.push(bed)
      map.set(bed.station, list)
    }
    return map
  }, [])

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (mealFilter !== "alle" && o.mealSlot !== mealFilter) return false
      if (statusFilter !== "alle" && o.status !== statusFilter) return false
      return true
    })
  }, [orders, mealFilter, statusFilter])

  function handleConfirm(orderId: string) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: "confirmed" as const } : o
      )
    )
    toast.success("Bestellung bestätigt")
  }

  function handleDeliver(orderId: string) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: "delivered" as const } : o
      )
    )
    toast.success("Bestellung als ausgeliefert markiert")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Krankenhausverwaltung"
        description="Bettenbelegung, Kostformen und Bestellungen"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Belegung</CardTitle>
            <BedDouble className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {occupiedBeds} / {totalBeds} Betten
            </div>
            <p className="text-muted-foreground text-xs">
              {occupancyRate} % Auslastung
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Offene Bestellungen
            </CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
            <p className="text-muted-foreground text-xs">
              ausstehende Mahlzeiten
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Kostformen aktiv
            </CardTitle>
            <CheckCircle2 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDietFormIds.size}</div>
            <p className="text-muted-foreground text-xs">
              verschiedene Kostformen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stationen</CardTitle>
            <BedDouble className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bedsByStation.size}</div>
            <p className="text-muted-foreground text-xs">
              {Array.from(bedsByStation.keys()).join(", ")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="betten" className="space-y-4">
        <TabsList>
          <TabsTrigger value="betten">Bettenbelegung</TabsTrigger>
          <TabsTrigger value="bestellungen">Bestellungen</TabsTrigger>
        </TabsList>

        {/* ── Bettenbelegung ── */}
        <TabsContent value="betten" className="space-y-6">
          {Array.from(bedsByStation.entries()).map(([station, beds]) => (
            <div key={station} className="space-y-3">
              <h2 className="text-lg font-semibold">{station}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {beds.map((bed) => (
                  <Card
                    key={bed.id}
                    className={`border-l-4 ${BED_BORDER_COLORS[bed.status]}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          Zi. {bed.room}-{bed.bed}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={
                            bed.status === "occupied"
                              ? "border-green-300 bg-green-50 text-green-700"
                              : bed.status === "reserved"
                                ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                                : "border-gray-300 bg-gray-50 text-gray-500"
                          }
                        >
                          {bed.status === "occupied"
                            ? "Belegt"
                            : bed.status === "reserved"
                              ? "Reserviert"
                              : "Frei"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="font-medium">
                        {bed.patientName ?? (
                          <span className="text-muted-foreground">
                            {bed.status === "reserved"
                              ? "Reserviert"
                              : "Frei"}
                          </span>
                        )}
                      </p>

                      {bed.dietFormIds.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {getDietFormBadges(bed.dietFormIds)}
                        </div>
                      )}

                      {bed.allergens.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {bed.allergens.map((a) => (
                            <Badge
                              key={a}
                              variant="outline"
                              className="border-red-300 bg-red-50 text-xs text-red-700"
                            >
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              {a}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {bed.admissionDate && (
                        <p className="text-muted-foreground text-xs">
                          Aufnahme: {formatDate(bed.admissionDate)}
                        </p>
                      )}

                      {bed.notes && (
                        <p className="text-muted-foreground text-xs italic">
                          {bed.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* ── Bestellungen ── */}
        <TabsContent value="bestellungen" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={mealFilter} onValueChange={setMealFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Mahlzeit" />
              </SelectTrigger>
              <SelectContent>
                {MEAL_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Orders table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zimmer</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Kostform</TableHead>
                    <TableHead>Mahlzeit</TableHead>
                    <TableHead>Besondere Hinweise</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-muted-foreground py-8 text-center"
                      >
                        Keine Bestellungen gefunden.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => {
                      const statusCfg = ORDER_STATUS_CONFIG[order.status]
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            Zi. {order.room}-{order.bed}
                          </TableCell>
                          <TableCell>{order.patientName}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {getDietFormBadges(order.dietFormIds)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {MEAL_SLOT_LABELS[
                              order.mealSlot as MealSlotType
                            ] ?? order.mealSlot}
                          </TableCell>
                          <TableCell className="max-w-[200px] text-sm">
                            {order.specialInstructions ?? (
                              <span className="text-muted-foreground">
                                &mdash;
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={statusCfg.className}
                            >
                              {statusCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {order.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfirm(order.id)}
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                Bestätigen
                              </Button>
                            )}
                            {order.status === "confirmed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeliver(order.id)}
                              >
                                <Truck className="mr-1 h-3.5 w-3.5" />
                                Ausliefern
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
