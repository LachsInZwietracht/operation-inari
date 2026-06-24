"use client";

import { useState } from "react";
import {
  BedDouble,
  CheckCircle2,
  ClipboardList,
  Euro,
  ShieldCheck,
  Star,
  TrendingDown,
  TrendingUp,
  Utensils,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { InstitutionAnalyticsResult } from "@/lib/institution-analytics";
import { PageHeader } from "@/components/page-header";
import { formatDate, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface InstitutionStatistikenClientProps {
  analytics: InstitutionAnalyticsResult;
}

function dayShortLabel(date: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(new Date(date));
}

export function InstitutionStatistikenClient({ analytics }: InstitutionStatistikenClientProps) {
  const [activeTab, setActiveTab] = useState("kostformen");

  if (!analytics.activeMenu) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Einrichtungsstatistiken"
          description="Kostformen, Menüwahl, Kosten und Leistungskennzahlen"
          helpText="Die Seite bündelt reale Kennzahlen aus aktivem Menüzyklus, Bestellungen und Stationsbelegung."
        />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Es gibt noch keinen aktiven Menüzyklus für institutionelle Kennzahlen.
          </CardContent>
        </Card>
      </div>
    );
  }

  const costChartData = analytics.costAnalysis.map((item) => ({
    day: dayShortLabel(item.date),
    Tageskosten: item.totalCost,
    "Kosten/Portion": item.costPerPortion,
  }));

  const fulfillmentChartData = analytics.fulfillmentByDate.map((item) => ({
    day: dayShortLabel(item.date),
    Ausstehend: item.pending,
    Bestätigt: item.confirmed,
    Ausgeliefert: item.delivered,
    Storniert: item.cancelled,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einrichtungsstatistiken"
        description="Kostformen, Menüwahl, Kosten und Leistungskennzahlen"
        helpText="Die Seite bündelt reale Kennzahlen aus aktivem Menüzyklus, Bestellungen und Stationsbelegung."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Belegungsrate</CardTitle>
            <BedDouble className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(analytics.overview.occupancyRate, 1)} %</div>
            <p className="text-xs text-muted-foreground">
              {analytics.overview.occupiedBeds} von {analytics.overview.totalBeds} bekannten Betten
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ø Kosten/Tag</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(analytics.overview.averageCostPerDay, 2)} €</div>
            <p className="text-xs text-muted-foreground">
              Ø {formatNumber(analytics.overview.averageCostPerPortion, 2)} € pro Portion
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aktive Kostformen</CardTitle>
            <Utensils className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.activeDietForms}</div>
            <p className="text-xs text-muted-foreground">{analytics.activeStayCount} aktive stationäre Fälle</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Compliance-Rate</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(analytics.overview.complianceRate, 1)} %</div>
            <p className="text-xs text-muted-foreground">{analytics.activeMenu.name}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="kostformen">Kostformen</TabsTrigger>
          <TabsTrigger value="menuewahl">Menüwahl</TabsTrigger>
          <TabsTrigger value="kosten">Kosten</TabsTrigger>
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
        </TabsList>

        <TabsContent value="kostformen" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Verteilung der Kostformen</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={analytics.dietFormCounts} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="dietFormName" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: unknown) => [`${Number(value ?? 0)} Zuordnungen`, "Anzahl"]} />
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
                  {analytics.dietFormCounts.map((item) => (
                    <TableRow key={item.dietFormId}>
                      <TableCell className="font-medium">{item.dietFormName}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.percentage, 1)} %</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menuewahl" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Beliebteste Gerichte</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={analytics.topRecipes} layout="vertical" margin={{ left: 140 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="recipeName" width={130} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: unknown) => [`${Number(value ?? 0)} Bestellungen`, "Anzahl"]} />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auftragsstatus im Zyklus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-4 md:grid-cols-4">
                {analytics.fulfillmentStats.map((item) => (
                  <Card key={item.status}>
                    <CardContent className="pt-4">
                      <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
                      <div className="text-2xl font-bold">{item.count}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={fulfillmentChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Ausstehend" stackId="orders" fill="hsl(var(--chart-4))" />
                  <Bar dataKey="Bestätigt" stackId="orders" fill="hsl(var(--chart-2))" />
                  <Bar dataKey="Ausgeliefert" stackId="orders" fill="hsl(var(--chart-1))" />
                  <Bar dataKey="Storniert" stackId="orders" fill="hsl(var(--chart-5))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kosten" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Zykluskosten gesamt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analytics.totalCycleCost, 2)} €</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Günstigster Tag</CardTitle>
                <TrendingDown className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analytics.cheapestDay?.totalCost ?? 0, 2)} €</div>
                <p className="text-xs text-muted-foreground">{analytics.cheapestDay ? formatDate(analytics.cheapestDay.date) : "–"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Teuerster Tag</CardTitle>
                <TrendingUp className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(analytics.mostExpensiveDay?.totalCost ?? 0, 2)} €</div>
                <p className="text-xs text-muted-foreground">{analytics.mostExpensiveDay ? formatDate(analytics.mostExpensiveDay.date) : "–"}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kostenverlauf des aktiven Zyklus</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={costChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value: unknown, name: unknown) => [`${formatNumber(Number(value ?? 0), 2)} €`, String(name ?? "")]} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="Tageskosten" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="Kosten/Portion" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 4 }} />
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
                  {analytics.costAnalysis.map((item) => (
                    <TableRow key={item.date}>
                      <TableCell className="font-medium">{formatDate(item.date)}</TableCell>
                      <TableCell className="text-right">{item.portionCount}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.totalCost, 2)} €</TableCell>
                      <TableCell className="text-right">{formatNumber(item.costPerPortion, 2)} €</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="uebersicht" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Gesamtbetten", value: String(analytics.overview.totalBeds), icon: BedDouble, desc: "bekannte Betten im Datensatz" },
              { label: "Belegte Betten", value: String(analytics.overview.occupiedBeds), icon: BedDouble, desc: `${formatNumber(analytics.overview.occupancyRate, 1)} % Auslastung` },
              { label: "Aktive Kostformen", value: String(analytics.overview.activeDietForms), icon: ClipboardList, desc: "Menü + Stationszuweisungen" },
              { label: "Offene Bestellungen", value: String(analytics.overview.pendingOrders), icon: Utensils, desc: "Status ausstehend" },
              { label: "Allergenprofile", value: String(analytics.activeAllergenProfileCount), icon: ShieldCheck, desc: "aktive Patienten mit Profil" },
              { label: "Einschränkungen", value: String(analytics.restrictedStayCount), icon: ShieldCheck, desc: "aktive Fälle mit Zusatzregeln" },
              { label: "Compliance-Rate", value: `${formatNumber(analytics.overview.complianceRate, 1)} %`, icon: CheckCircle2, desc: "über den aktiven Zyklus" },
              { label: "Bestellungen mit Regeln", value: String(analytics.ordersWithRestrictions), icon: Star, desc: "inkl. Diät/Allergen-Snapshot" },
            ].map((item) => (
              <Card key={item.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{item.value}</div>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Zyklus- und Fulfillment-Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{analytics.activeMenu.name}</Badge>
                <Badge variant="outline">
                  {formatDate(analytics.cycleDates[0])} – {formatDate(analytics.cycleDates[analytics.cycleDates.length - 1])}
                </Badge>
                {analytics.fulfillmentStats.map((item) => (
                  <Badge key={item.status} variant="secondary">
                    {item.label}: {item.count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
