"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { MealOrder } from "@/lib/types";
import { MEAL_ORDERS } from "@/lib/mock-data";
import {
  deleteMealOrderClient,
  fetchMealOrdersClient,
  persistMealOrder,
} from "@/lib/data/meal-orders-client";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "prodi_meal_orders";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

function loadFromStorage(): MealOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MealOrder[];
  } catch {
    return [];
  }
}

function sortOrders(items: MealOrder[]) {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (a.station !== b.station) return a.station.localeCompare(b.station, "de");
    if (a.room !== b.room) return a.room.localeCompare(b.room, "de");
    return a.bed.localeCompare(b.bed, "de");
  });
}

function buildInitialOrders() {
  const stored = loadFromStorage();
  const storedIds = new Set(stored.map((order) => order.id));
  const mockOnly = MEAL_ORDERS.filter((order) => !storedIds.has(order.id));
  return sortOrders([...mockOnly, ...stored]);
}

export function useMealOrders() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<MealOrder[]>(buildInitialOrders);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const migrationDone = useRef(false);
  const ordersRef = useRef(orders);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    try {
      const custom = orders.filter((order) => !MEAL_ORDERS.some((mockOrder) => mockOrder.id === order.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    } catch {
      // ignore
    }
  }, [orders]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    let cancelled = false;
    setIsLoadingRemote(true);

    async function syncOrders() {
      try {
        const remoteOrders = await fetchMealOrdersClient();
        if (cancelled) return;

        const localOnly = ordersRef.current.filter((order) => !isUuid(order.id));
        const merged = [...remoteOrders];

        for (const local of localOnly) {
          if (!remoteOrders.some((remoteOrder) => remoteOrder.id === local.id)) {
            merged.push(local);
          }
        }

        setOrders(sortOrders(merged));

        if (!migrationDone.current) {
          migrationDone.current = true;
          const pendingMigration = localOnly.filter((order) => !remoteOrders.some((remoteOrder) => remoteOrder.id === order.id));

          for (const order of pendingMigration) {
            void persistMealOrder(order)
              .then((persisted) => {
                setOrders((prev) => sortOrders(prev.map((item) => (item.id === order.id ? persisted : item))));
              })
              .catch((err) => {
                console.error(`Failed to migrate meal order ${order.id}:`, err);
              });
          }
        }
      } catch (error) {
        console.error("Failed to sync meal orders from Supabase:", error);
      } finally {
        if (!cancelled) setIsLoadingRemote(false);
      }
    }

    void syncOrders();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  const upsertOrder = useCallback((payload: Omit<MealOrder, "id" | "createdAt" | "updatedAt"> & { id?: string }) => {
    const now = new Date().toISOString();
    const nextId = payload.id ?? `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nextOrder: MealOrder = {
      ...payload,
      id: nextId,
      createdAt: now,
      updatedAt: now,
    };

    setOrders((prev) => {
      const filtered = prev.filter((order) => !(order.inpatientStayId === payload.inpatientStayId && order.date === payload.date && order.mealSlot === payload.mealSlot) && order.id !== nextId);
      return sortOrders([...filtered, nextOrder]);
    });

    if (isAuthenticated) {
      void persistMealOrder(nextOrder)
        .then((persisted) => {
          setOrders((prev) => {
            const filtered = prev.filter((order) => order.id !== nextId && !(order.inpatientStayId === persisted.inpatientStayId && order.date === persisted.date && order.mealSlot === persisted.mealSlot));
            return sortOrders([...filtered, persisted]);
          });
        })
        .catch((err) => {
          console.error("Failed to persist meal order:", err);
        });
    }

    return nextOrder;
  }, [isAuthenticated]);

  const updateOrderStatus = useCallback((id: string, status: MealOrder["status"]) => {
    setOrders((prev) => {
      const next = prev.map((order) =>
        order.id === id || order.legacyId === id
          ? { ...order, status, updatedAt: new Date().toISOString() }
          : order,
      );
      const updated = next.find((order) => order.id === id || order.legacyId === id);
      if (updated && isAuthenticated) {
        void persistMealOrder(updated).then((persisted) => {
          setOrders((current) => sortOrders(current.map((item) => (item.id === updated.id ? persisted : item))));
        }).catch((err) => {
          console.error("Failed to update meal order in Supabase:", err);
        });
      }
      return sortOrders(next);
    });
  }, [isAuthenticated]);

  const deleteOrder = useCallback((id: string) => {
    setOrders((prev) => prev.filter((order) => order.id !== id && order.legacyId !== id));
    if (isAuthenticated) {
      void deleteMealOrderClient(id).catch((err) => {
        console.error("Failed to delete meal order in Supabase:", err);
      });
    }
  }, [isAuthenticated]);

  return {
    orders,
    upsertOrder,
    updateOrderStatus,
    deleteOrder,
    isLoadingRemote,
  };
}
