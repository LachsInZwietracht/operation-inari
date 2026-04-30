import type {
  AssessmentMethod,
  MealSlotType,
  NutrientGroup,
  ProtocolType,
} from "@/lib/types";

export const MEAL_SLOT_LABELS: Record<MealSlotType, string> = {
  fruehstueck: "Frühstück",
  snack_vormittag: "Snack (Vormittag)",
  mittagessen: "Mittagessen",
  snack_nachmittag: "Snack (Nachmittag)",
  abendessen: "Abendessen",
};

export const NUTRIENT_GROUP_LABELS: Record<NutrientGroup, string> = {
  makronaehrstoffe: "Makronährstoffe",
  vitamine: "Vitamine",
  mineralstoffe: "Mineralstoffe",
  aminosaeuren: "Aminosäuren",
  fettsaeuren: "Fettsäuren (Detail)",
  sonstige: "Sonstige",
};

export const APP_NAME = "Inari";
export const APP_DESCRIPTION = "Professionelle Ernährungsberatung";

export const INDICATION_OPTIONS = [
  "Adipositas",
  "Diabetes mellitus Typ 2",
  "Diabetes mellitus Typ 1",
  "Zöliakie",
  "Nahrungsmittelallergie",
  "Nahrungsmittelunverträglichkeit",
  "Reizdarmsyndrom",
  "Chronisch-entzündliche Darmerkrankung",
  "Niereninsuffizienz",
  "Fettstoffwechselstörung",
  "Hyperurikämie / Gicht",
  "Mangelernährung",
  "Essstörung",
  "Schwangerschaft / Stillzeit",
  "Sonstige",
] as const;

export const COUNSELING_DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;

export const PROTOCOL_TYPE_LABELS: Record<ProtocolType, string> = {
  ernaehrungsprotokoll: "Ernährungsprotokoll",
  "24h_recall": "24-Stunden-Recall",
  food_frequency: "Food Frequency Questionnaire",
  household: "Haushaltsmengen-Protokoll",
};

export const ASSESSMENT_METHOD_LABELS: Record<AssessmentMethod, string> = {
  "24h_recall": "24h Recall",
  ffq: "Food Frequency Questionnaire",
  diet_diary: "Mehr-Tages-Tagebuch",
  dietary_history: "Ernährungsanamnese",
  household: "Haushaltsmengen",
  freiburg: "Freiburger Protokoll",
  vegetarian: "Vegetarisches Template",
  vegan: "Veganes Template",
};

export interface HouseholdMeasureDefinition {
  id: string;
  label: string;
  grams: number;
  hint: string;
}

export const HOUSEHOLD_MEASURES: HouseholdMeasureDefinition[] = [
  { id: "teaspoon", label: "Teelöffel", grams: 5, hint: "z. B. Öl, Zucker" },
  { id: "tablespoon", label: "Esslöffel", grams: 15, hint: "z. B. Öl, Haferflocken" },
  { id: "cup", label: "Tasse (240 ml)", grams: 240, hint: "Suppen, Getränke" },
  { id: "glass", label: "Glas (200 ml)", grams: 200, hint: "Säfte, Wasser" },
  { id: "slice", label: "Scheibe", grams: 30, hint: "Brot, Käse" },
  { id: "handful", label: "Handvoll", grams: 40, hint: "Nüsse, Beeren" },
  { id: "piece", label: "Stück", grams: 100, hint: "Obst, Gebäck" },
  { id: "scoop", label: "Schöpfkelle", grams: 180, hint: "Eintöpfe" },
];

export interface HouseholdPresetDefinition {
  id: string;
  label: string;
  foodId: string;
  mealSlot: MealSlotType;
  measureId: string;
  quantity: number;
  defaultTime?: string;
}

export const HOUSEHOLD_PRESETS: HouseholdPresetDefinition[] = [
  {
    id: "preset_haferbrei",
    label: "1 Tasse Haferflocken",
    foodId: "food_haferflocken",
    mealSlot: "fruehstueck",
    measureId: "cup",
    quantity: 1,
    defaultTime: "07:00",
  },
  {
    id: "preset_glass_wasser",
    label: "1 Glas Orangensaft",
    foodId: "food_orangensaft",
    mealSlot: "snack_vormittag",
    measureId: "glass",
    quantity: 1,
    defaultTime: "10:00",
  },
  {
    id: "preset_suppe",
    label: "1 Schöpfkelle Linsengemüse",
    foodId: "food_rote_linsen",
    mealSlot: "mittagessen",
    measureId: "scoop",
    quantity: 1,
    defaultTime: "12:30",
  },
  {
    id: "preset_handvoll_nuesse",
    label: "Handvoll Nüsse",
    foodId: "food_mandeln",
    mealSlot: "snack_nachmittag",
    measureId: "handful",
    quantity: 1,
    defaultTime: "15:30",
  },
  {
    id: "preset_scheibe_brot",
    label: "1 Scheibe Vollkornbrot",
    foodId: "food_vollkornbrot",
    mealSlot: "abendessen",
    measureId: "slice",
    quantity: 1,
    defaultTime: "19:00",
  },
];

export const AMPUTATION_AREAS = [
  { id: "hand", label: "Hand (1,2%)", factor: 0.012 },
  { id: "unterarm", label: "Unterarm (2,3%)", factor: 0.023 },
  { id: "ganzer_arm", label: "Ganzer Arm (4,9%)", factor: 0.049 },
  { id: "fuss", label: "Fuß (1,8%)", factor: 0.018 },
  { id: "unterschenkel", label: "Unterschenkel (5,9%)", factor: 0.059 },
  { id: "oberbein", label: "Oberbein (10,1%)", factor: 0.101 },
  { id: "gesamtes_bein", label: "Ganzes Bein (18,6%)", factor: 0.186 },
] as const;
