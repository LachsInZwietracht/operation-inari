/**
 * Deterministic SFK test food objects.
 *
 * These mirror the shape a real SFK import produces and can be used in
 * Playwright tests to verify display, entitlement gating, and source metadata
 * without requiring an actual SFK database license.
 */

import type { Food } from "@/lib/types";

/** A typical SFK food item — apple (Apfel, frisch) */
export const SFK_APPLE: Food = {
  id: "sfk_test_apfel_frisch",
  name: "Apfel, frisch",
  categoryId: "obst",
  source: "SFK 8.1",
  sourceId: "sfk",
  sourceVersion: "8.1",
  blsCode: undefined,
  baseAmount: 100,
  nutrients: [
    { nutrientId: "energie", amount: 54 },
    { nutrientId: "energie_kj", amount: 228 },
    { nutrientId: "eiweiss", amount: 0.3 },
    { nutrientId: "fett", amount: 0.4 },
    { nutrientId: "kohlenhydrate", amount: 11.4 },
    { nutrientId: "ballaststoffe", amount: 2.0 },
    { nutrientId: "wasser", amount: 85.3 },
    { nutrientId: "zucker", amount: 10.3 },
    { nutrientId: "vitamin_c", amount: 12 },
    { nutrientId: "kalium", amount: 144 },
    { nutrientId: "calcium", amount: 7 },
    { nutrientId: "magnesium", amount: 6 },
    { nutrientId: "eisen", amount: 0.5 },
  ],
  portionSizes: [
    { label: "1 mittelgrosser Apfel", amount: 150 },
  ],
  dataQualityScore: 95,
  createdAt: "2026-01-15T00:00:00Z",
  updatedAt: "2026-01-15T00:00:00Z",
};

/** SFK egg item — used for amino acid coverage */
export const SFK_EGG: Food = {
  id: "sfk_test_huehnerei_gesamt",
  name: "Hühnerei, Gesamt",
  categoryId: "eier",
  source: "SFK 8.1",
  sourceId: "sfk",
  sourceVersion: "8.1",
  baseAmount: 100,
  nutrients: [
    { nutrientId: "energie", amount: 156 },
    { nutrientId: "eiweiss", amount: 12.8 },
    { nutrientId: "fett", amount: 11.3 },
    { nutrientId: "kohlenhydrate", amount: 0.7 },
    { nutrientId: "wasser", amount: 74.4 },
    { nutrientId: "vitamin_a", amount: 270 },
    { nutrientId: "vitamin_d", amount: 2.9 },
    { nutrientId: "vitamin_b12", amount: 1.9 },
    { nutrientId: "eisen", amount: 2.1 },
    { nutrientId: "zink", amount: 1.4 },
    // SFK-exclusive amino acids
    { nutrientId: "sfk_leucin", amount: 1080 },
    { nutrientId: "sfk_lysin", amount: 914 },
    { nutrientId: "sfk_methionin", amount: 392 },
  ],
  portionSizes: [
    { label: "1 Ei (Gr. M)", amount: 58 },
  ],
  dataQualityScore: 98,
  createdAt: "2026-01-15T00:00:00Z",
  updatedAt: "2026-01-15T00:00:00Z",
};

/** All SFK sample foods as a single array for iteration */
export const SFK_SAMPLE_FOODS: Food[] = [SFK_APPLE, SFK_EGG];
