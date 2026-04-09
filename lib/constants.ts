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
