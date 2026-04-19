import { ALLERGEN_MAP } from "@/lib/allergen-constants";
import type { AllergenSeverity, AllergenType } from "@/lib/allergen-constants";
import type { PatientAllergenEntry } from "@/lib/types";

export interface AllergenWarning {
  allergenId: string;
  allergenLabel: string;
  type: AllergenType;
  severity: AllergenSeverity;
  matchedToken: string;
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
