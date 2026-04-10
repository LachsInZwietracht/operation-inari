import { ID, Timestamped } from "./common";

export interface Ingredient {
  foodId: ID;
  amount: number; // in grams
}

export type RecipeLibraryScope = "personal" | "community" | "institution" | "shared";

export interface RecipeReferenceTarget {
  id: ID;
  label: string;
  nutrientId: string;
  unit: string;
  target: number;
}

export interface Recipe extends Timestamped {
  id: ID;
  name: string;
  description: string;
  category: string;
  servings: number;
  prepTime: number; // minutes
  cookTime: number; // minutes
  ingredients: Ingredient[];
  instructions: string[];
  imageUrl?: string;
  allergens?: string[];
  additives?: string[];
  prodScore?: number; // 0-100
  co2PerPortion?: number;
  referenceTargets?: RecipeReferenceTarget[];
  tags?: string[];
  sourceType?: RecipeLibraryScope;
  teachingKitchenNotes?: string;
}
