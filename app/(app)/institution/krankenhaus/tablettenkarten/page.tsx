"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { ALLERGEN_MAP } from "@/lib/allergen-constants";
import { useMealOrders } from "@/hooks/use-meal-orders";
import type { MealSlotType } from "@/lib/types";

export default function TablettenkartenPage() {
  const searchParams = useSearchParams();
  const { orders } = useMealOrders();
  const date = searchParams.get("date") ?? "";
  const mealSlot = (searchParams.get("mealSlot") ?? "mittagessen") as MealSlotType;
  const station = searchParams.get("station") ?? "alle";

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.date !== date) return false;
      if (order.mealSlot !== mealSlot) return false;
      if (station !== "alle" && order.station !== station) return false;
      return true;
    });
  }, [date, mealSlot, orders, station]);

  return (
    <div className="min-h-screen bg-white p-6 text-black print:p-4">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Tablettenkarten</h1>
          <p className="text-sm text-slate-600">
            {date} · {MEAL_SLOT_LABELS[mealSlot]} {station !== "alle" ? `· ${station}` : ""}
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Drucken
        </Button>
      </div>

      {filteredOrders.length === 0 ? (
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="py-12 text-center text-slate-500">
            Keine Tablettenkarten für dieses Servicefenster.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="break-inside-avoid rounded-xl border border-slate-300 p-4 print:rounded-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{order.patientName}</p>
                  <p className="text-sm text-slate-600">
                    {order.station} · Zimmer {order.room}-{order.bed}
                  </p>
                </div>
                <Badge variant="outline">{MEAL_SLOT_LABELS[order.mealSlot]}</Badge>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gericht</p>
                <p className="text-xl font-semibold">{order.recipeName}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {order.dietFormIdsSnapshot.map((dietFormId) => (
                  <Badge key={dietFormId} variant="outline">
                    {dietFormId}
                  </Badge>
                ))}
                {order.allergenIdsSnapshot.map((allergenId) => (
                  <Badge key={allergenId} variant="outline" className="border-red-300 text-red-700">
                    {ALLERGEN_MAP.get(allergenId)?.label ?? allergenId}
                  </Badge>
                ))}
              </div>

              {order.specialInstructions && (
                <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                  {order.specialInstructions}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
