import { ID, Timestamped } from "./common";

export interface Ingredient {
  foodId: ID;
  amount: number; // in grams
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
}
