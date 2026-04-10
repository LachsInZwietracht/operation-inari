import type { FoodGroupNode } from "@/lib/types"

/**
 * BLS food group hierarchy following the Bundeslebensmittelschlüssel structure.
 * The first letter of the BLS code indicates the main group.
 */
export const FOOD_GROUPS: FoodGroupNode[] = [
  {
    id: "fg_B",
    name: "Brot und Kleingebäck",
    children: [
      { id: "fg_B1", name: "Weizenbrot" },
      { id: "fg_B2", name: "Roggenbrot" },
      { id: "fg_B3", name: "Mischbrot" },
      { id: "fg_B4", name: "Vollkornbrot" },
      { id: "fg_B5", name: "Kleingebäck / Brötchen" },
    ],
  },
  {
    id: "fg_C",
    name: "Cerealien, Getreide und Teigwaren",
    children: [
      { id: "fg_C1", name: "Weizen und Weizenmehl" },
      { id: "fg_C2", name: "Roggen und Roggenmehl" },
      { id: "fg_C3", name: "Hafer und Haferflocken" },
      { id: "fg_C4", name: "Reis" },
      { id: "fg_C5", name: "Teigwaren / Nudeln" },
      { id: "fg_C6", name: "Sonstige Getreide" },
    ],
  },
  {
    id: "fg_D",
    name: "Kuchen und Gebäck",
    children: [
      { id: "fg_D1", name: "Feine Backwaren" },
      { id: "fg_D2", name: "Kekse und Waffeln" },
    ],
  },
  {
    id: "fg_E",
    name: "Eier",
    children: [
      { id: "fg_E1", name: "Hühnereier" },
      { id: "fg_E2", name: "Sonstige Eier" },
    ],
  },
  {
    id: "fg_F",
    name: "Fette und Öle",
    children: [
      { id: "fg_F1", name: "Butter" },
      { id: "fg_F2", name: "Margarine" },
      { id: "fg_F3", name: "Pflanzenöle" },
      { id: "fg_F4", name: "Tierische Fette" },
    ],
  },
  {
    id: "fg_G",
    name: "Gemüse und Gemüseerzeugnisse",
    children: [
      { id: "fg_G1", name: "Blattgemüse" },
      { id: "fg_G2", name: "Kohlgemüse" },
      { id: "fg_G3", name: "Fruchtgemüse" },
      { id: "fg_G4", name: "Wurzelgemüse" },
      { id: "fg_G5", name: "Zwiebelgemüse" },
      { id: "fg_G6", name: "Hülsenfrüchte" },
      { id: "fg_G7", name: "Pilze" },
      { id: "fg_G8", name: "Sprossen und Keime" },
    ],
  },
  {
    id: "fg_H",
    name: "Getränke",
    children: [
      { id: "fg_H1", name: "Wasser und Mineralwasser" },
      { id: "fg_H2", name: "Säfte und Nektare" },
      { id: "fg_H3", name: "Erfrischungsgetränke" },
      { id: "fg_H4", name: "Kaffee und Tee" },
      { id: "fg_H5", name: "Alkoholische Getränke" },
    ],
  },
  {
    id: "fg_K",
    name: "Kartoffeln und Kartoffelerzeugnisse",
    children: [
      { id: "fg_K1", name: "Kartoffeln roh / gegart" },
      { id: "fg_K2", name: "Kartoffelerzeugnisse" },
    ],
  },
  {
    id: "fg_M",
    name: "Milch und Milcherzeugnisse",
    children: [
      { id: "fg_M1", name: "Konsummilch" },
      { id: "fg_M2", name: "Joghurt und Sauermilch" },
      { id: "fg_M3", name: "Käse" },
      { id: "fg_M4", name: "Quark und Frischkäse" },
      { id: "fg_M5", name: "Sahne und Kondensmilch" },
    ],
  },
  {
    id: "fg_N",
    name: "Nüsse, Samen und Ölfrüchte",
    children: [
      { id: "fg_N1", name: "Nüsse" },
      { id: "fg_N2", name: "Samen und Kerne" },
    ],
  },
  {
    id: "fg_O",
    name: "Obst und Obsterzeugnisse",
    children: [
      { id: "fg_O1", name: "Kernobst" },
      { id: "fg_O2", name: "Steinobst" },
      { id: "fg_O3", name: "Beerenobst" },
      { id: "fg_O4", name: "Zitrusfrüchte" },
      { id: "fg_O5", name: "Exotische Früchte" },
      { id: "fg_O6", name: "Trockenobst" },
    ],
  },
  {
    id: "fg_R",
    name: "Fleisch und Fleischerzeugnisse",
    children: [
      { id: "fg_R1", name: "Rindfleisch" },
      { id: "fg_R2", name: "Schweinefleisch" },
      { id: "fg_R3", name: "Geflügel" },
      { id: "fg_R4", name: "Wild" },
      { id: "fg_R5", name: "Innereien" },
      { id: "fg_R6", name: "Wurstwaren" },
    ],
  },
  {
    id: "fg_S",
    name: "Fisch und Meeresfrüchte",
    children: [
      { id: "fg_S1", name: "Seefisch" },
      { id: "fg_S2", name: "Süßwasserfisch" },
      { id: "fg_S3", name: "Meeresfrüchte" },
      { id: "fg_S4", name: "Fischerzeugnisse" },
    ],
  },
  {
    id: "fg_T",
    name: "Süßwaren und Zucker",
    children: [
      { id: "fg_T1", name: "Zucker und Honig" },
      { id: "fg_T2", name: "Schokolade und Konfekt" },
      { id: "fg_T3", name: "Speiseeis" },
    ],
  },
  {
    id: "fg_W",
    name: "Gewürze und Würzmittel",
    children: [
      { id: "fg_W1", name: "Kräuter" },
      { id: "fg_W2", name: "Gewürze" },
      { id: "fg_W3", name: "Saucen und Dressings" },
    ],
  },
]

/**
 * Flattened lookup: groupId → group name
 */
export function getFoodGroupName(groupId: string): string | undefined {
  for (const group of FOOD_GROUPS) {
    if (group.id === groupId) return group.name
    for (const child of group.children ?? []) {
      if (child.id === groupId) return child.name
    }
  }
  return undefined
}

/**
 * Get all food group IDs under a parent (including the parent itself).
 */
export function getFoodGroupDescendants(groupId: string): string[] {
  for (const group of FOOD_GROUPS) {
    if (group.id === groupId) {
      return [group.id, ...(group.children ?? []).map((c) => c.id)]
    }
    for (const child of group.children ?? []) {
      if (child.id === groupId) return [child.id]
    }
  }
  return []
}
