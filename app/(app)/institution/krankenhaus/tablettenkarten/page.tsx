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
import { DIET_FORMS } from "@/lib/reference-data/institution";
import type { MealOrder, MealSlotType } from "@/lib/types";

const DIET_FORM_MAP = new Map(DIET_FORMS.map((dietForm) => [dietForm.id, dietForm]));

const ORDER_STATUS_CONFIG: Record<MealOrder["status"], { label: string; className: string }> = {
  pending: {
    label: "Ausstehend",
    className: "border-yellow-300 text-yellow-800",
  },
  confirmed: {
    label: "Bestätigt",
    className: "border-blue-300 text-blue-800",
  },
  delivered: {
    label: "Ausgeliefert",
    className: "border-green-300 text-green-800",
  },
  cancelled: {
    label: "Storniert",
    className: "border-slate-300 text-slate-700",
  },
};

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
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="outline">{MEAL_SLOT_LABELS[order.mealSlot]}</Badge>
                  <Badge variant="outline" className={ORDER_STATUS_CONFIG[order.status].className}>
                    {ORDER_STATUS_CONFIG[order.status].label}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gericht</p>
                <p className="text-xl font-semibold">{order.recipeName}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-slate-200 p-3 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Datum</p>
                  <p>{order.date}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bett</p>
                  <p>{order.room}-{order.bed}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {order.dietFormIdsSnapshot.map((dietFormId) => (
                  <Badge key={dietFormId} variant="outline">
                    {DIET_FORM_MAP.get(dietFormId)?.shortName ?? dietFormId}
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

              {order.restrictionSummary.length > 0 && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Prüfhinweise</p>
                  <ul className="list-inside list-disc space-y-1">
                    {order.restrictionSummary.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
