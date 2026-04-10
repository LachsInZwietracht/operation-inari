"use client";

import { useMemo } from "react";
import { Plus, Printer, Calendar, Utensils } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  INSTITUTION_MENUS,
  DIET_FORMS,
  RECIPES,
  DAY_LABELS,
} from "@/lib/mock-data";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import type { InstitutionMenu, MealSlotType } from "@/lib/types";

const VISIBLE_MEAL_SLOTS: MealSlotType[] = [
  "fruehstueck",
  "mittagessen",
  "abendessen",
];

const STATUS_CONFIG: Record<
  InstitutionMenu["status"],
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  active: { label: "Aktiv", variant: "default" },
  draft: { label: "Entwurf", variant: "secondary" },
  archived: { label: "Archiviert", variant: "outline" },
};

const MEAL_SLOT_COLORS: Record<string, string> = {
  fruehstueck: "bg-amber-50 dark:bg-amber-950/30",
  mittagessen: "bg-emerald-50 dark:bg-emerald-950/30",
  abendessen: "bg-blue-50 dark:bg-blue-950/30",
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDietFormName(dietFormId: string): string {
  return DIET_FORMS.find((d) => d.id === dietFormId)?.name ?? dietFormId;
}

export default function MenuePlannungPage() {
  const activeMenu = useMemo(
    () => INSTITUTION_MENUS.find((m) => m.status === "active"),
    []
  );

  const recipeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const recipe of RECIPES) {
      map.set(recipe.id, recipe.name);
    }
    return map;
  }, []);

  const dietFormMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const df of DIET_FORMS) {
      map.set(df.id, df.name);
    }
    return map;
  }, []);

  // Compute daily portion totals for the active plan (first week)
  const dailyPortionTotals = useMemo(() => {
    if (!activeMenu || activeMenu.weeks.length === 0) return [];
    const week = activeMenu.weeks[0];
    return DAY_LABELS.map((_, dayIndex) => {
      const day = week.days.find((d) => d.dayOfWeek === dayIndex);
      if (!day) return 0;
      return day.dietMenus.reduce(
        (total, dm) =>
          total +
          dm.slots
            .filter((s) => VISIBLE_MEAL_SLOTS.includes(s.type))
            .reduce((sum, s) => sum + s.portionCount, 0),
        0
      );
    });
  }, [activeMenu]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menüplanung"
        description="Wöchentliche und zyklische Menüpläne für die Einrichtung"
      >
        <Button variant="outline" disabled>
          <Printer className="mr-2 h-4 w-4" />
          Druckvorschau
        </Button>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Menüplan
        </Button>
      </PageHeader>

      {/* Menu plan list */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {INSTITUTION_MENUS.map((menu) => {
          const statusCfg = STATUS_CONFIG[menu.status];
          return (
            <Card
              key={menu.id}
              className={
                menu.status === "active"
                  ? "border-primary/50 ring-1 ring-primary/20"
                  : ""
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{menu.name}</CardTitle>
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Start: {formatDate(menu.startDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Utensils className="h-4 w-4" />
                  <span>
                    {menu.cycleLength === 1
                      ? "1-Wochen-Zyklus"
                      : `${menu.cycleLength}-Wochen-Zyklus`}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {menu.dietFormIds.length} Kostform
                  {menu.dietFormIds.length !== 1 ? "en" : ""}:{" "}
                  {menu.dietFormIds
                    .map((id) => dietFormMap.get(id) ?? id)
                    .join(", ")}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active plan weekly grid */}
      {activeMenu && activeMenu.weeks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {activeMenu.name} — Wochenübersicht
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue={activeMenu.dietFormIds[0]}
              className="space-y-4"
            >
              <TabsList>
                {activeMenu.dietFormIds.map((dfId) => (
                  <TabsTrigger key={dfId} value={dfId}>
                    {getDietFormName(dfId)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {activeMenu.dietFormIds.map((dfId) => (
                <TabsContent key={dfId} value={dfId}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 z-10 bg-background min-w-[120px]">
                            Mahlzeit
                          </TableHead>
                          {DAY_LABELS.map((day) => (
                            <TableHead
                              key={day}
                              className="min-w-[140px] text-center"
                            >
                              {day}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {VISIBLE_MEAL_SLOTS.map((slotType) => (
                          <TableRow key={slotType}>
                            <TableCell className="sticky left-0 z-10 bg-background font-medium">
                              {MEAL_SLOT_LABELS[slotType]}
                            </TableCell>
                            {DAY_LABELS.map((_, dayIndex) => {
                              const day = activeMenu.weeks[0].days.find(
                                (d) => d.dayOfWeek === dayIndex
                              );
                              const dietMenu = day?.dietMenus.find(
                                (dm) => dm.dietFormId === dfId
                              );
                              const slot = dietMenu?.slots.find(
                                (s) => s.type === slotType
                              );

                              return (
                                <TableCell
                                  key={dayIndex}
                                  className="text-center p-2"
                                >
                                  {slot ? (
                                    <div
                                      className={`rounded-md p-2 ${MEAL_SLOT_COLORS[slotType] ?? ""}`}
                                    >
                                      <div className="text-sm font-medium leading-tight">
                                        {recipeMap.get(slot.recipeId) ??
                                          slot.recipeId}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {slot.portionCount} Portionen
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* Summary row */}
            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">
                Gesamtportionen pro Tag (alle Kostformen)
              </h3>
              <div className="grid grid-cols-7 gap-2">
                {DAY_LABELS.map((day, idx) => (
                  <div
                    key={day}
                    className="rounded-md border p-3 text-center"
                  >
                    <div className="text-xs text-muted-foreground font-medium">
                      {day}
                    </div>
                    <div className="text-lg font-bold mt-1">
                      {dailyPortionTotals[idx] ?? 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
