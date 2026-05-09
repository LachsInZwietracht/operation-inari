import { ALLERGEN_MAP } from "@/lib/allergen-constants";
import type { AllergenSeverity, AllergenType } from "@/lib/allergen-constants";
import type {
  DailyMealPlan,
  Food,
  MealEntry,
  MealSlotType,
  PatientAllergenEntry,
  Recipe,
} from "@/lib/types";

export interface AllergenWarning {
  allergenId: string;
  allergenLabel: string;
  type: AllergenType;
  severity: AllergenSeverity;
  matchedToken: string;
}

const SEVERITY_RANK: Record<AllergenSeverity, number> = {
  mild: 1,
  moderate: 2,
  severe: 3,
};

export function compareSeverity(a: AllergenSeverity, b: AllergenSeverity): number {
  return SEVERITY_RANK[a] - SEVERITY_RANK[b];
}

export function maxSeverity(
  severities: AllergenSeverity[],
): AllergenSeverity | null {
  if (severities.length === 0) return null;
  return severities.reduce((acc, current) =>
    SEVERITY_RANK[current] > SEVERITY_RANK[acc] ? current : acc,
  );
}

export interface PlanAllergenConflictAggregate {
  allergenId: string;
  allergenLabel: string;
  type: AllergenType;
  severity: AllergenSeverity;
  entryIds: Set<string>;
  slotTypes: Set<MealSlotType>;
}

export interface PlanAllergenSummary {
  totalConflicts: number;
  affectedEntryIds: Set<string>;
  highestSeverity: AllergenSeverity | null;
  byAllergen: PlanAllergenConflictAggregate[];
  byEntry: Map<string, AllergenWarning[]>;
}

function getEntryAllergens(
  entry: MealEntry,
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
): string[] {
  if (entry.type === "food") {
    return foodMap.get(entry.referenceId)?.allergens ?? [];
  }
  return recipeMap.get(entry.referenceId)?.allergens ?? [];
}

/**
 * Aggregates allergen conflicts for an entire daily meal plan.
 * Returns per-entry warnings as well as per-allergen rollups (which slots/entries
 * are affected) and the highest severity encountered, so the UI can render a
 * day-top banner and apply severity-based blocking.
 */
export function summarizePlanAllergenConflicts(
  plan: DailyMealPlan,
  patientAllergens: PatientAllergenEntry[],
  foodMap: Map<string, Food>,
  recipeMap: Map<string, Recipe>,
): PlanAllergenSummary {
  const summary: PlanAllergenSummary = {
    totalConflicts: 0,
    affectedEntryIds: new Set(),
    highestSeverity: null,
    byAllergen: [],
    byEntry: new Map(),
  };

  if (patientAllergens.length === 0) return summary;

  const aggregates = new Map<string, PlanAllergenConflictAggregate>();

  for (const slot of plan.slots) {
    for (const entry of slot.entries) {
      const itemAllergens = getEntryAllergens(entry, foodMap, recipeMap);
      if (itemAllergens.length === 0) continue;

      const warnings = checkAllergenConflicts(itemAllergens, patientAllergens);
      if (warnings.length === 0) continue;

      summary.byEntry.set(entry.id, warnings);
      summary.affectedEntryIds.add(entry.id);
      summary.totalConflicts += warnings.length;

      for (const warning of warnings) {
        let aggregate = aggregates.get(warning.allergenId);
        if (!aggregate) {
          aggregate = {
            allergenId: warning.allergenId,
            allergenLabel: warning.allergenLabel,
            type: warning.type,
            severity: warning.severity,
            entryIds: new Set(),
            slotTypes: new Set(),
          };
          aggregates.set(warning.allergenId, aggregate);
        }
        aggregate.entryIds.add(entry.id);
        aggregate.slotTypes.add(slot.type);
      }
    }
  }

  summary.byAllergen = Array.from(aggregates.values()).sort(
    (a, b) => compareSeverity(b.severity, a.severity) || b.entryIds.size - a.entryIds.size,
  );
  summary.highestSeverity = maxSeverity(summary.byAllergen.map((a) => a.severity));
  return summary;
}

/**
 * Check if any of the item's allergen strings conflict with the patient's allergen profile.
 * Matches via `foodMatchTokens` (case-insensitive substring).
 */
export function checkAllergenConflicts(
  itemAllergens: string[],
  patientAllergens: PatientAllergenEntry[],
): AllergenWarning[] {
  if (itemAllergens.length === 0 || patientAllergens.length === 0) return [];

  const warnings: AllergenWarning[] = [];
  const seen = new Set<string>();

  for (const pa of patientAllergens) {
    const def = ALLERGEN_MAP.get(pa.allergenId);
    if (!def) continue;

    for (const token of def.foodMatchTokens) {
      const tokenLower = token.toLowerCase();
      for (const itemAllergen of itemAllergens) {
        if (itemAllergen.toLowerCase().includes(tokenLower)) {
          if (!seen.has(pa.allergenId)) {
            seen.add(pa.allergenId);
            warnings.push({
              allergenId: pa.allergenId,
              allergenLabel: def.label,
              type: pa.type,
              severity: pa.severity,
              matchedToken: token,
            });
          }
          break;
        }
      }
      if (seen.has(pa.allergenId)) break;
    }
  }

  return warnings;
}
