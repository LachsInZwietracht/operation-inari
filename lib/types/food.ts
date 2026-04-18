import { ID, Timestamped } from "./common";
import { NutrientValue } from "./nutrients";

export type FoodSourceId =
  | "bls"
  | "sfk"
  | "usda"
  | "afcd"
  | "swiss"
  | "ciqual"
  | "cofid"
  | "off"
  | "hersteller"
  | "custom";

export interface FoodSourceDefinition {
  id: FoodSourceId;
  name: string;
  version: string;
  updatedAt: string;
  description: string;
  coverage: string;
}

export interface FoodDatabaseUpdate {
  id: ID;
  sourceId: FoodSourceId;
  version: string;
  releaseDate: string;
  notes: string;
  highlights: string[];
}

export interface FoodCategory {
  id: ID;
  name: string;
  icon: string; // lucide icon name
}

export interface FoodPortionSize {
  label: string;
  amount: number; // grams for this portion definition
}

export interface FoodGroupNode {
  id: string;
  name: string;
  children?: FoodGroupNode[];
}

export interface Food extends Timestamped {
  id: ID;
  name: string;
  categoryId: ID;
  source: string; // e.g. "BLS 3.02", "Eigene Eingabe"
  sourceId?: FoodSourceId;
  sourceVersion?: string;
  /** BLS code or other database-specific identifier */
  blsCode?: string;
  /** ID of the food group within the hierarchy */
  foodGroupId?: string;
  nutrients: NutrientValue[];
  /** base amount in grams for the nutrient values */
  baseAmount: number;
  manufacturer?: string;
  allergens?: string[];
  additives?: string[];
  co2PerPortion?: number;
  sustainabilityScore?: number;
  prodScore?: number;
  dataQualityScore?: number;
  isBranded?: boolean;
  isCustom?: boolean;
  isRecipeDerived?: boolean;
  portionSizes?: FoodPortionSize[];
  tags?: string[];
}

export interface FoodSynonym extends Timestamped {
  id: ID;
  foodId: ID;
  /** Display alias provided by the practitioner */
  name: string;
  /** Locale for multilingual food names */
  locale?: string;
  /** Person/source that created this synonym */
  createdBy: string;
  source?: "system" | "user";
  usageCount?: number;
  /** Flag if this synonym should override the canonical food name */
  isPrimary?: boolean;
}

export interface FoodSearchItem {
  id: ID;
  name: string;
  categoryId: ID;
  sourceId?: FoodSourceId;
  isCustom?: boolean;
}

export interface FoodBrowserQuery {
  q?: string;
  mode?: "name" | "code" | "group" | "browse";
  categoryId?: string | null;
  dataSourceId?: FoodSourceId | "all" | null;
  groupId?: string | null;
  page?: number;
  pageSize?: number;
}

export interface FoodBrowserResult {
  foods: Food[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
