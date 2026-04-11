import type { MealSlotType, NutrientGroup, ProtocolType } from "@/lib/types";

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
};

export const APP_NAME = "Prodi";
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
};

export const AMPUTATION_AREAS = [
  { id: "hand", label: "Hand (1,2%)", factor: 0.012 },
  { id: "unterarm", label: "Unterarm (2,3%)", factor: 0.023 },
  { id: "ganzer_arm", label: "Ganzer Arm (4,9%)", factor: 0.049 },
  { id: "fuss", label: "Fuß (1,8%)", factor: 0.018 },
  { id: "unterschenkel", label: "Unterschenkel (5,9%)", factor: 0.059 },
  { id: "oberbein", label: "Oberbein (10,1%)", factor: 0.101 },
  { id: "gesamtes_bein", label: "Ganzes Bein (18,6%)", factor: 0.186 },
] as const;
