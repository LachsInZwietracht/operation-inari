import { ID } from "./common";

export type NutrientGroup = "makronaehrstoffe" | "vitamine" | "mineralstoffe" | "sonstige";

export interface NutrientDefinition {
  id: ID;
  name: string;
  shortName: string;
  unit: string;
  group: NutrientGroup;
  sortOrder: number;
}

export interface NutrientValue {
  nutrientId: ID;
  amount: number;
}

export interface ReferenceValue {
  nutrientId: ID;
  /** daily reference value in the nutrient's unit */
  amount: number;
  gender: "m" | "w";
  label: string;
}
