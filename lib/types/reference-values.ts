import { ID, Timestamped } from "./common";

/**
 * Identifier for a reference standard organisation.
 * - dge: Deutsche Gesellschaft für Ernährung
 * - oege: Österreichische Gesellschaft für Ernährung
 * - sge: Schweizerische Gesellschaft für Ernährung
 * - rda: Recommended Dietary Allowances (US)
 * - custom: User-created profile
 */
export type ReferenceStandardId = "dge" | "oege" | "sge" | "rda" | "custom";

/**
 * Age bracket definition used across DACH and RDA standards.
 * Values represent the age range in years (inclusive).
 */
export interface AgeGroup {
  id: string;
  label: string;
  /** Minimum age in years (inclusive) */
  minAge: number;
  /** Maximum age in years (inclusive), use Infinity for open-ended */
  maxAge: number;
}

/**
 * Life stages that modify reference values beyond age/gender.
 */
export type LifeStage =
  | "none"
  | "pregnant_t1"
  | "pregnant_t2"
  | "pregnant_t3"
  | "lactating";

export const LIFE_STAGE_LABELS: Record<LifeStage, string> = {
  none: "Keine Besonderheit",
  pregnant_t1: "Schwanger (1. Trimester)",
  pregnant_t2: "Schwanger (2. Trimester)",
  pregnant_t3: "Schwanger (3. Trimester)",
  lactating: "Stillend",
};

/**
 * A single nutrient reference value within a specific demographic context.
 */
export interface ReferenceNutrientValue {
  nutrientId: string;
  /** Daily reference amount in the nutrient's native unit */
  amount: number;
}

/**
 * A complete set of reference values for a specific demographic bracket.
 */
export interface ReferenceBracket {
  ageGroupId: string;
  gender: "m" | "w";
  lifeStage: LifeStage;
  values: ReferenceNutrientValue[];
}

/**
 * A reference standard from an official organisation, containing
 * brackets for all supported age/gender/life-stage combinations.
 */
export interface ReferenceStandard {
  id: ReferenceStandardId;
  name: string;
  shortName: string;
  description: string;
  country: string;
  /** Year of the edition used */
  edition: string;
  brackets: ReferenceBracket[];
}

/**
 * A user-created custom reference profile, optionally based on
 * an existing standard with individual overrides.
 */
export interface CustomReferenceProfile extends Timestamped {
  id: ID;
  name: string;
  description?: string;
  /** Standard this profile was derived from (if any) */
  basedOn?: ReferenceStandardId;
  /** Fixed demographic context for this profile */
  ageGroupId: string;
  gender: "m" | "w";
  lifeStage: LifeStage;
  /** Overridden nutrient values — only contains values that differ from the base */
  overrides: ReferenceNutrientValue[];
}

/**
 * Resolved reference configuration for a patient or analysis context.
 * This is what gets passed to nutrient comparison components.
 */
export interface ResolvedReferenceConfig {
  standardId: ReferenceStandardId;
  standardName: string;
  ageGroupId: string;
  ageGroupLabel: string;
  gender: "m" | "w";
  lifeStage: LifeStage;
  /** Custom profile ID if using a custom profile */
  customProfileId?: ID;
  /** The final resolved nutrient values */
  values: ReferenceNutrientValue[];
}
