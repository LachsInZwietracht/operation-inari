import type { DailyMealPlan, Food, MealEntry, Recipe } from "@/lib/types";
import {
  ADDITIVES,
  ADDITIVE_CATEGORIES,
  ADDITIVE_CLINICAL_FLAGS,
  type Additive,
  type AdditiveCategory,
  type AdditiveCategoryId,
  type AdditiveClinicalFlag,
} from "@/lib/reference-data/additives";

const CATEGORY_MAP: Map<AdditiveCategoryId, AdditiveCategory> = new Map(
  ADDITIVE_CATEGORIES.map((category) => [category.id, category]),
);

const UNKNOWN_CATEGORY: AdditiveCategory =
  CATEGORY_MAP.get("other") ?? {
    id: "other",
    label: "Sonstige",
    description: "Weitere technologische Zusatzstoffe.",
    badgeClass: "bg-slate-100 text-slate-900 border-slate-200",
  };

const CODE_INDEX: Map<string, Additive> = new Map(ADDITIVES.map((a) => [a.code.toUpperCase(), a]));

/**
 * Canonicalises a free-text additive token to the form used in the catalog.
 *
 * Accepts inputs like "E951", "e 951", "E-951", "E951i" — all collapse to
 * "E951" (sub-classes like "E472a" are preserved). Returns the input trimmed
 * and uppercased if it does not look like an E-number, so unknown vendor codes
 * still flow through without being mangled.
 */
export function normalizeAdditiveCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const compact = trimmed.replace(/\s|-/g, "").toUpperCase();
  const match = compact.match(/^E(\d{3,4})([A-Z]{0,2})$/);
  if (!match) return compact;
  const [, digits, suffix] = match;
  return `E${digits}${suffix.toLowerCase()}`.toUpperCase();
}

export function lookupAdditive(code: string): Additive | undefined {
  return CODE_INDEX.get(normalizeAdditiveCode(code));
}

export function getAdditiveCategory(id: AdditiveCategoryId): AdditiveCategory {
  return CATEGORY_MAP.get(id) ?? UNKNOWN_CATEGORY;
}

export interface ResolvedAdditive {
  /** Canonical code, e.g. "E951". For unknown tokens this is the user input. */
  code: string;
  /** German display name. Falls back to the code when no catalog entry exists. */
  name: string;
  category: AdditiveCategory;
  clinicalFlags: AdditiveClinicalFlag[];
  notes?: string;
  /** True when the code wasn't found in the curated registry. */
  isUnknown: boolean;
}

/**
 * Resolves a raw list of additive tokens (as stored on a `Food`) to display-
 * ready entries. De-duplicates by canonical code and preserves first-seen
 * order, which matches user expectation when codes appear multiple times due
 * to noisy source data.
 */
export function resolveAdditives(codes: readonly string[]): ResolvedAdditive[] {
  const seen = new Set<string>();
  const resolved: ResolvedAdditive[] = [];
  for (const raw of codes) {
    const code = normalizeAdditiveCode(raw);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const match = CODE_INDEX.get(code);
    if (match) {
      resolved.push({
        code: match.code,
        name: match.name,
        category: getAdditiveCategory(match.categoryId),
        clinicalFlags: match.clinicalFlags,
        notes: match.notes,
        isUnknown: false,
      });
    } else {
      resolved.push({
        code,
        name: code,
        category: UNKNOWN_CATEGORY,
        clinicalFlags: [],
        isUnknown: true,
      });
    }
  }
  return resolved;
}

export interface ClinicalFlagSummary {
  flag: AdditiveClinicalFlag;
  label: string;
  description: string;
  severity: "info" | "warning";
  /** Additives in the input list that carry this flag. */
  contributors: ResolvedAdditive[];
}

/**
 * Buckets a resolved list by clinical flag so the UI can render at most one
 * warning row per flag while still showing which additives triggered it.
 */
export function summarizeClinicalFlags(
  resolved: readonly ResolvedAdditive[],
): ClinicalFlagSummary[] {
  const buckets = new Map<AdditiveClinicalFlag, ResolvedAdditive[]>();
  for (const additive of resolved) {
    for (const flag of additive.clinicalFlags) {
      const existing = buckets.get(flag);
      if (existing) {
        existing.push(additive);
      } else {
        buckets.set(flag, [additive]);
      }
    }
  }
  return Array.from(buckets.entries()).map(([flag, contributors]) => {
    const meta = ADDITIVE_CLINICAL_FLAGS[flag];
    return {
      flag,
      label: meta.label,
      description: meta.description,
      severity: meta.severity,
      contributors,
    };
  });
}

export interface CategorizedAdditives {
  category: AdditiveCategory;
  items: ResolvedAdditive[];
}

/**
 * Groups resolved additives by their LMIV functional class. Categories appear
 * in the order they're declared in `ADDITIVE_CATEGORIES`, so the UI gets a
 * stable, predictable layout regardless of input order.
 */
export function groupAdditivesByCategory(
  resolved: readonly ResolvedAdditive[],
): CategorizedAdditives[] {
  const buckets = new Map<AdditiveCategoryId, ResolvedAdditive[]>();
  for (const additive of resolved) {
    const existing = buckets.get(additive.category.id);
    if (existing) {
      existing.push(additive);
    } else {
      buckets.set(additive.category.id, [additive]);
    }
  }
  return ADDITIVE_CATEGORIES.filter((category) => buckets.has(category.id)).map((category) => ({
    category,
    items: buckets.get(category.id) ?? [],
  }));
}

export interface PlanAdditiveSummary {
  resolved: ResolvedAdditive[];
  /** Distinct food/recipe entries referencing each additive code. */
  occurrenceCounts: Map<string, number>;
  clinicalFlags: ClinicalFlagSummary[];
}

/**
 * Aggregates every additive that appears in any meal slot of a plan. Useful
 * for the plan-level "Zusatzstoffe in diesem Plan" surface — kept here even
 * if not wired into UI yet, since the food and recipe types both carry the
 * `additives` field and clinic users frequently ask for this overview.
 */
export function aggregatePlanAdditives(
  plan: DailyMealPlan,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
): PlanAdditiveSummary {
  const counts = new Map<string, number>();
  for (const slot of plan.slots) {
    for (const entry of slot.entries) {
      const codes = collectEntryAdditives(entry, foodMap, recipeMap);
      for (const code of codes) {
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    }
  }
  const resolved = resolveAdditives(Array.from(counts.keys()));
  return {
    resolved,
    occurrenceCounts: new Map(
      resolved.map((additive) => [additive.code, counts.get(additive.code) ?? 0]),
    ),
    clinicalFlags: summarizeClinicalFlags(resolved),
  };
}

function collectEntryAdditives(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
): string[] {
  if (entry.type === "food") {
    const food = foodMap.get(entry.referenceId);
    return food?.additives ?? [];
  }
  const recipe = recipeMap.get(entry.referenceId);
  if (!recipe) return [];
  const direct = recipe.additives ?? [];
  const fromIngredients = recipe.ingredients.flatMap((ingredient) => {
    const food = foodMap.get(ingredient.foodId);
    return food?.additives ?? [];
  });
  return [...direct, ...fromIngredients];
}

export type { Additive, AdditiveCategory, AdditiveCategoryId, AdditiveClinicalFlag };
