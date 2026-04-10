"use client"

import { useState } from "react"
import {
  BedDouble,
  Euro,
  Utensils,
  ShieldCheck,
  Star,
  TrendingUp,
  TrendingDown,
  ClipboardList,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DIET_FORM_COUNTS,
  MENU_CHOICE_STATS,
  COST_ANALYSIS,
  INSTITUTION_OVERVIEW_STATS,
} from "@/lib/mock-data"
import { formatNumber } from "@/lib/format"

const stats = INSTITUTION_OVERVIEW_STATS

const DAY_SHORT: Record<string, string> = {
  "2026-04-06": "Mo",
  "2026-04-07": "Di",
  "2026-04-08": "Mi",
  "2026-04-09": "Do",
  "2026-04-10": "Fr",
  "2026-04-11": "Sa",
  "2026-04-12": "So",
}

const costChartData = COST_ANALYSIS.map((c) => ({
  day: DAY_SHORT[c.date] ?? c.date,
  Tageskosten: c.totalCost,
  "Kosten/Portion": c.costPerPortion,
}))

const totalWeeklyCost = COST_ANALYSIS.reduce((s, c) => s + c.totalCost, 0)
const minCost = COST_ANALYSIS.reduce((m, c) => (c.totalCost < m.totalCost ? c : m), COST_ANALYSIS[0])
const maxCost = COST_ANALYSIS.reduce((m, c) => (c.totalCost > m.totalCost ? c : m), COST_ANALYSIS[0])

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="text-muted-foreground ml-1 text-xs">{formatNumber(rating, 1)}</span>
    </span>
  )
}

export default function InstitutionStatistikenPage() {
  const [activeTab, setActiveTab] = useState("kostformen")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einrichtungsstatistiken"
        description="Kostformen, Menüwahl, Kosten und Leistungskennzahlen"
        helpText="Analysieren Sie Kennzahlen Ihrer Einrichtung: Belegungsraten, Kostformenverteilung, Menüwahl-Statistiken und Kostenentwicklung auf einen Blick."
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Belegungsrate</CardTitle>
            <BedDouble className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.occupancyRate, 1)} %</div>
            <p className="text-muted-foreground text-xs">
              {stats.occupiedBeds} von {stats.totalBeds} Betten
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ø Kosten/Tag</CardTitle>
            <Euro className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.averageCostPerDay, 2)} €</div>
            <p className="text-muted-foreground text-xs">
              Ø {formatNumber(stats.averageCostPerPortion, 2)} € pro Portion
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aktive Kostformen</CardTitle>
            <Utensils className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeDietForms}</div>
            <p className="text-muted-foreground text-xs">verschiedene Diätlinien</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Compliance-Rate</CardTitle>
            <ShieldCheck className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.complianceRate, 1)} %</div>
            <p className="text-muted-foreground text-xs">Nährstoffziele erreicht</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="kostformen">Kostformen</TabsTrigger>
          <TabsTrigger value="menuewahl">Menüwahl</TabsTrigger>
          <TabsTrigger value="kosten">Kosten</TabsTrigger>
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
        </TabsList>

        {/* ── Kostformen ── */}
        <TabsContent value="kostformen" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Verteilung der Kostformen</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={DIET_FORM_COUNTS} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="dietFormName" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value} Patienten`, "Anzahl"]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detailübersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kostform</TableHead>
                    <TableHead className="text-right">Anzahl</TableHead>
                    <TableHead className="text-right">Anteil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DIET_FORM_COUNTS.map((d) => (
                    <TableRow key={d.dietFormId}>
                      <TableCell className="font-medium">{d.dietFormName}</TableCell>
                      <TableCell className="text-right">{d.count}</TableCell>
                      <TableCell className="text-right">{formatNumber(d.percentage, 1)} %</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Menüwahl ── */}
        <TabsContent value="menuewahl" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Beliebteste Gerichte</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={MENU_CHOICE_STATS} layout="vertical" margin={{ left: 140 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="recipeName" width={130} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value} Bestellungen`, "Anzahl"]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rezeptbewertungen</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rezept</TableHead>
                    <TableHead className="text-right">Bestellungen</TableHead>
                    <TableHead className="text-right">Bewertung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...MENU_CHOICE_STATS]
                    .sort((a, b) => b.count - a.count)
                    .map((m) => (
                      <TableRow key={m.recipeId}>
                        <TableCell className="font-medium">{m.recipeName}</TableCell>
                        <TableCell className="text-right">{m.count}</TableCell>
                        <TableCell className="text-right">
                          <RatingStars rating={m.rating} />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Kosten ── */}
        <TabsContent value="kosten" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Wochenkosten gesamt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(totalWeeklyCost, 2)} €</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Günstigster Tag</CardTitle>
                <TrendingDown className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(minCost.totalCost, 2)} €</div>
                <p className="text-muted-foreground text-xs">{DAY_SHORT[minCost.date]}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Teuerster Tag</CardTitle>
                <TrendingUp className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(maxCost.totalCost, 2)} €</div>
                <p className="text-muted-foreground text-xs">{DAY_SHORT[maxCost.date]}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kostenverlauf der Woche</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={costChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${formatNumber(value, 2)} €`,
                      name,
                    ]}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="Tageskosten"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Kosten/Portion"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tagesdetails</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead className="text-right">Portionen</TableHead>
                    <TableHead className="text-right">Tageskosten</TableHead>
                    <TableHead className="text-right">Kosten/Portion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COST_ANALYSIS.map((c) => (
                    <TableRow key={c.date}>
                      <TableCell className="font-medium">{DAY_SHORT[c.date] ?? c.date}</TableCell>
                      <TableCell className="text-right">{c.portionCount}</TableCell>
                      <TableCell className="text-right">{formatNumber(c.totalCost, 2)} €</TableCell>
                      <TableCell className="text-right">{formatNumber(c.costPerPortion, 2)} €</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Übersicht ── */}
        <TabsContent value="uebersicht">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Gesamtbetten", value: String(stats.totalBeds), icon: BedDouble, desc: "in der Einrichtung" },
              { label: "Belegte Betten", value: String(stats.occupiedBeds), icon: BedDouble, desc: `${formatNumber(stats.occupancyRate, 1)} % Auslastung` },
              { label: "Aktive Kostformen", value: String(stats.activeDietForms), icon: ClipboardList, desc: "verschiedene Diätlinien" },
              { label: "Offene Bestellungen", value: String(stats.pendingOrders), icon: Utensils, desc: "ausstehend" },
              { label: "Ø Tageskosten", value: `${formatNumber(stats.averageCostPerDay, 2)} €`, icon: Euro, desc: "alle Kostformen" },
              { label: "Ø Portionskosten", value: `${formatNumber(stats.averageCostPerPortion, 2)} €`, icon: Euro, desc: "pro Portion" },
              { label: "Compliance-Rate", value: `${formatNumber(stats.complianceRate, 1)} %`, icon: ShieldCheck, desc: "Nährstoffziele" },
              { label: "Wochenkosten", value: `${formatNumber(totalWeeklyCost, 2)} €`, icon: TrendingUp, desc: "KW 15" },
            ].map((item) => (
              <Card key={item.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
                  <item.icon className="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{item.value}</div>
                  <p className="text-muted-foreground text-xs">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
