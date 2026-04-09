import { ID, Timestamped } from "./common";
import { NutrientValue } from "./nutrients";

export interface FoodCategory {
  id: ID;
  name: string;
  icon: string; // lucide icon name
}

export interface Food extends Timestamped {
  id: ID;
  name: string;
  categoryId: ID;
  source: string; // e.g. "BLS 3.02", "Eigene Eingabe"
  nutrients: NutrientValue[];
  /** base amount in grams for the nutrient values */
  baseAmount: number;
}
