/**
 * Demo data for the Ernährungsplan design studio (`/ernaehrungsplan/design-studio`).
 *
 * The three design drafts are prototypes for a design decision, not a second
 * implementation of the planner: they run on this fixed catalogue instead of
 * Supabase so a colleague can open the page, click through every interaction
 * and never hit an empty patient, a missing diet line or a slow catalogue
 * query. Nothing here is written back anywhere.
 *
 * Nutrient figures are BLS-typical round values — good enough to make the
 * targets, gaps and warnings behave realistically, not a data source.
 */

export type DemoSlotType =
  | "fruehstueck"
  | "snack_vormittag"
  | "mittagessen"
  | "snack_nachmittag"
  | "abendessen"

export const DEMO_SLOT_ORDER: DemoSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

export const DEMO_SLOT_LABELS: Record<DemoSlotType, string> = {
  fruehstueck: "Frühstück",
  snack_vormittag: "Snack am Vormittag",
  mittagessen: "Mittagessen",
  snack_nachmittag: "Snack am Nachmittag",
  abendessen: "Abendessen",
}

/** Short form for tight rows (week board, day strip, status bars). */
export const DEMO_SLOT_SHORT: Record<DemoSlotType, string> = {
  fruehstueck: "Frühstück",
  snack_vormittag: "Snack vorm.",
  mittagessen: "Mittag",
  snack_nachmittag: "Snack nachm.",
  abendessen: "Abend",
}

/** Rough clock time per slot — used where the plan is drawn as a day timeline. */
export const DEMO_SLOT_TIME: Record<DemoSlotType, string> = {
  fruehstueck: "07:30",
  snack_vormittag: "10:00",
  mittagessen: "12:30",
  snack_nachmittag: "15:30",
  abendessen: "18:30",
}

export type NutrientKey =
  | "kcal"
  | "protein"
  | "carbs"
  | "fat"
  | "fiber"
  | "calcium"
  | "iron"
  | "vitaminC"
  | "vitaminD"
  | "magnesium"
  | "potassium"

/**
 * Nutrients in one fixed order so the catalogue below stays readable as a
 * table. Index meaning:
 * [kcal, Eiweiß g, KH g, Fett g, Ballaststoffe g,
 *  Calcium mg, Eisen mg, Vitamin C mg, Vitamin D µg, Magnesium mg, Kalium mg]
 */
const NUTRIENT_KEYS: NutrientKey[] = [
  "kcal",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "calcium",
  "iron",
  "vitaminC",
  "vitaminD",
  "magnesium",
  "potassium",
]

type NutrientTuple = [
  number, number, number, number, number,
  number, number, number, number, number, number,
]

export type Nutrients = Record<NutrientKey, number>

export const EMPTY_NUTRIENTS: Nutrients = {
  kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
  calcium: 0, iron: 0, vitaminC: 0, vitaminD: 0, magnesium: 0, potassium: 0,
}

function toNutrients(tuple: NutrientTuple): Nutrients {
  const result = { ...EMPTY_NUTRIENTS }
  NUTRIENT_KEYS.forEach((key, index) => {
    result[key] = tuple[index]
  })
  return result
}

export type DemoItemKind = "food" | "recipe"

export interface DemoItem {
  id: string
  name: string
  kind: DemoItemKind
  /** Library grouping, shown as the secondary line in every picker. */
  category: string
  /** Unit the amount is entered in. */
  unit: "g" | "Portion"
  /** Amount the nutrients refer to: 100 (g) for foods, 1 (portion) for recipes. */
  base: number
  /** Default amount offered when the item is added to a meal. */
  step: number
  nutrients: Nutrients
  /** Allergens carried by the item — drives the warning states in the drafts. */
  allergens?: string[]
  /** Additive E-numbers, for the "Zusatzstoffe" surface. */
  additives?: string[]
}

function food(
  id: string,
  name: string,
  category: string,
  step: number,
  tuple: NutrientTuple,
  extras: { allergens?: string[]; additives?: string[] } = {},
): DemoItem {
  return {
    id, name, category, kind: "food", unit: "g", base: 100, step,
    nutrients: toNutrients(tuple), ...extras,
  }
}

function recipe(
  id: string,
  name: string,
  category: string,
  tuple: NutrientTuple,
  extras: { allergens?: string[] } = {},
): DemoItem {
  return {
    id, name, category, kind: "recipe", unit: "Portion", base: 1, step: 1,
    nutrients: toNutrients(tuple), ...extras,
  }
}

/*                        kcal    P     KH    F   Ball   Ca   Fe  VitC VitD   Mg    K   */
export const DEMO_FOODS: DemoItem[] = [
  food("f-haferflocken", "Haferflocken", "Getreide", 60,
    [372, 13.5, 58.7, 7.0, 10.0, 54, 4.6, 0, 0, 130, 350], { allergens: ["Gluten"] }),
  food("f-milch", "Milch 1,5 %", "Milchprodukte", 200,
    [47, 3.4, 4.9, 1.6, 0, 120, 0.1, 1, 0, 12, 157], { allergens: ["Laktose"] }),
  food("f-naturjoghurt", "Naturjoghurt 1,5 %", "Milchprodukte", 150,
    [50, 3.6, 4.6, 1.5, 0, 125, 0.1, 1, 0, 12, 160], { allergens: ["Laktose"] }),
  food("f-magerquark", "Magerquark", "Milchprodukte", 150,
    [71, 13.5, 4.1, 0.3, 0, 92, 0.1, 1, 0, 11, 95], { allergens: ["Laktose"] }),
  food("f-frischkaese", "Frischkäse 16 %", "Milchprodukte", 30,
    [158, 9.0, 3.5, 11.5, 0, 90, 0.1, 0, 0.2, 10, 100], { allergens: ["Laktose"] }),
  food("f-gouda", "Gouda 45 % F.i.Tr.", "Milchprodukte", 30,
    [356, 25.0, 0, 28.0, 0, 800, 0.2, 0, 0.8, 30, 90], { allergens: ["Laktose"] }),
  food("f-heidelbeeren", "Heidelbeeren", "Obst", 80,
    [42, 0.6, 6.1, 0.6, 4.9, 10, 0.7, 22, 0, 2, 78]),
  food("f-banane", "Banane", "Obst", 120,
    [95, 1.2, 21.4, 0.2, 2.0, 8, 0.4, 11, 0, 36, 382]),
  food("f-apfel", "Apfel", "Obst", 130,
    [54, 0.3, 11.4, 0.6, 2.0, 6, 0.3, 12, 0, 6, 120]),
  food("f-vollkornbrot", "Vollkornbrot", "Getreide", 60,
    [200, 6.9, 38.2, 1.2, 7.4, 45, 2.0, 0, 0, 65, 230], { allergens: ["Gluten"] }),
  food("f-knaeckebrot", "Vollkorn-Knäckebrot", "Getreide", 20,
    [330, 10.0, 62.0, 1.5, 15.0, 40, 3.5, 0, 0, 90, 380], { allergens: ["Gluten"] }),
  food("f-vollkornnudeln", "Vollkornnudeln, gegart", "Getreide", 200,
    [141, 5.6, 26.9, 1.0, 3.7, 15, 1.3, 0, 0, 45, 90], { allergens: ["Gluten"] }),
  food("f-basmatireis", "Basmatireis, gegart", "Getreide", 180,
    [130, 2.7, 28.0, 0.3, 0.4, 10, 0.4, 0, 0, 12, 35]),
  food("f-kartoffeln", "Kartoffeln, gegart", "Gemüse", 200,
    [70, 2.0, 14.8, 0.1, 1.2, 8, 0.4, 14, 0, 20, 410]),
  food("f-brokkoli", "Brokkoli, gedünstet", "Gemüse", 150,
    [34, 3.8, 2.7, 0.2, 3.0, 58, 0.8, 89, 0, 24, 310]),
  food("f-moehren", "Möhren", "Gemüse", 120,
    [39, 1.0, 7.1, 0.2, 3.6, 35, 0.4, 7, 0, 13, 320]),
  food("f-tomate", "Tomate", "Gemüse", 100,
    [18, 0.9, 2.6, 0.2, 1.0, 9, 0.3, 19, 0, 11, 240]),
  food("f-paprika", "Paprika, rot", "Gemüse", 120,
    [37, 1.0, 6.4, 0.3, 3.6, 11, 0.5, 140, 0, 14, 210]),
  food("f-feldsalat", "Feldsalat", "Gemüse", 60,
    [14, 1.8, 0.7, 0.4, 1.8, 35, 2.0, 35, 0, 13, 420]),
  food("f-avocado", "Avocado", "Gemüse", 80,
    [221, 1.9, 0.4, 23.5, 6.3, 11, 0.6, 13, 0, 29, 480]),
  food("f-linsen", "Linsen, gegart", "Hülsenfrüchte", 150,
    [116, 9.0, 17.0, 0.4, 7.8, 19, 3.3, 1, 0, 36, 370]),
  food("f-kichererbsen", "Kichererbsen, gegart", "Hülsenfrüchte", 150,
    [139, 8.9, 16.1, 2.6, 7.6, 49, 2.9, 1, 0, 48, 290]),
  food("f-hummus", "Hummus", "Hülsenfrüchte", 40,
    [306, 7.4, 12.0, 24.0, 6.0, 45, 2.4, 1, 0, 40, 230], { allergens: ["Sesam"] }),
  food("f-haehnchen", "Hähnchenbrustfilet", "Fleisch & Fisch", 150,
    [106, 22.8, 0, 1.4, 0, 11, 0.7, 0, 0.1, 30, 350]),
  food("f-lachs", "Lachsfilet", "Fleisch & Fisch", 150,
    [202, 20.4, 0, 13.6, 0, 13, 0.7, 0, 16.0, 28, 350], { allergens: ["Fisch"] }),
  food("f-ei", "Ei, gekocht", "Fleisch & Fisch", 60,
    [137, 12.9, 0.7, 9.3, 0, 56, 1.8, 0, 2.9, 12, 138], { allergens: ["Ei"] }),
  food("f-walnuesse", "Walnüsse", "Nüsse & Fette", 20,
    [663, 15.2, 10.6, 62.5, 6.1, 87, 2.5, 3, 0, 130, 440], { allergens: ["Schalenfrüchte"] }),
  food("f-mandeln", "Mandeln", "Nüsse & Fette", 20,
    [570, 18.7, 5.4, 54.1, 9.8, 252, 4.1, 0, 0, 170, 835], { allergens: ["Schalenfrüchte"] }),
  food("f-olivenoel", "Olivenöl", "Nüsse & Fette", 10,
    [884, 0, 0, 99.6, 0, 1, 0.1, 0, 0, 0, 1]),
  food("f-fruchtjoghurt", "Fruchtjoghurt, Erdbeere", "Milchprodukte", 150,
    [96, 3.0, 15.6, 2.4, 0.3, 110, 0.1, 2, 0, 11, 145],
    { allergens: ["Laktose"], additives: ["E 440", "E 330", "E 160c"] }),
]

/*                          kcal    P    KH    F   Ball   Ca   Fe  VitC VitD   Mg    K   */
export const DEMO_RECIPES: DemoItem[] = [
  recipe("r-oats", "Overnight Oats mit Beeren", "Frühstück",
    [392, 15.0, 52.0, 11.0, 9.0, 210, 4.0, 18, 0.1, 140, 610],
    { allergens: ["Gluten", "Laktose"] }),
  recipe("r-ruehrei", "Rührei mit Vollkornbrot & Tomaten", "Frühstück",
    [418, 24.0, 34.0, 20.0, 7.0, 150, 3.4, 20, 4.4, 80, 520],
    { allergens: ["Gluten", "Ei"] }),
  recipe("r-quark", "Quark mit Beeren & Walnüssen", "Snack",
    [298, 22.0, 16.0, 16.0, 5.0, 180, 1.6, 20, 0, 70, 480],
    { allergens: ["Laktose", "Schalenfrüchte"] }),
  recipe("r-suppe", "Gemüsesuppe mit Linsen", "Suppen",
    [265, 14.0, 32.0, 6.0, 11.0, 70, 3.6, 35, 0, 90, 780]),
  recipe("r-bolo", "Linsen-Bolognese mit Vollkornnudeln", "Hauptgericht",
    [561, 26.0, 78.0, 12.0, 16.0, 90, 6.0, 22, 0, 160, 980],
    { allergens: ["Gluten"] }),
  recipe("r-lachs", "Ofenlachs mit Brokkoli & Kartoffeln", "Hauptgericht",
    [523, 38.0, 40.0, 22.0, 8.0, 110, 2.4, 120, 22.0, 130, 1500],
    { allergens: ["Fisch"] }),
  recipe("r-bowl", "Kichererbsen-Bowl mit Tahini", "Hauptgericht",
    [486, 19.0, 52.0, 20.0, 14.0, 180, 5.2, 60, 0, 150, 900],
    { allergens: ["Sesam"] }),
  recipe("r-wok", "Hähnchen-Wok mit Basmatireis", "Hauptgericht",
    [512, 36.0, 58.0, 12.0, 6.0, 60, 2.2, 90, 0.2, 90, 780]),
]

export const DEMO_ITEMS: DemoItem[] = [...DEMO_RECIPES, ...DEMO_FOODS]

export const DEMO_ITEM_MAP = new Map(DEMO_ITEMS.map((item) => [item.id, item]))

export interface DemoTemplate {
  id: string
  name: string
  indication: string
  kcal: number
  slots: Array<{ type: DemoSlotType; entries: Array<{ itemId: string; amount: number }> }>
}

export const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    id: "t-mediterran",
    name: "Mediterran",
    indication: "Herz-Kreislauf · 2.100 kcal",
    kcal: 2100,
    slots: [
      { type: "fruehstueck", entries: [{ itemId: "r-oats", amount: 1 }] },
      { type: "snack_vormittag", entries: [{ itemId: "f-apfel", amount: 130 }, { itemId: "f-mandeln", amount: 25 }] },
      { type: "mittagessen", entries: [{ itemId: "r-lachs", amount: 1 }] },
      { type: "snack_nachmittag", entries: [{ itemId: "f-naturjoghurt", amount: 150 }, { itemId: "f-heidelbeeren", amount: 80 }] },
      { type: "abendessen", entries: [{ itemId: "f-vollkornbrot", amount: 120 }, { itemId: "f-hummus", amount: 40 }, { itemId: "f-paprika", amount: 120 }] },
    ],
  },
  {
    id: "t-diabetes",
    name: "Diabetes Typ 2 · Basis",
    indication: "Kohlenhydratmodifiziert · 1.900 kcal",
    kcal: 1900,
    slots: [
      { type: "fruehstueck", entries: [{ itemId: "r-ruehrei", amount: 1 }] },
      { type: "snack_vormittag", entries: [{ itemId: "f-walnuesse", amount: 20 }] },
      { type: "mittagessen", entries: [{ itemId: "r-bowl", amount: 1 }] },
      { type: "snack_nachmittag", entries: [{ itemId: "f-magerquark", amount: 150 }, { itemId: "f-heidelbeeren", amount: 100 }] },
      { type: "abendessen", entries: [{ itemId: "f-haehnchen", amount: 150 }, { itemId: "f-brokkoli", amount: 200 }, { itemId: "f-olivenoel", amount: 10 }] },
    ],
  },
  {
    id: "t-eiweiss",
    name: "Eiweißreich",
    indication: "Sarkopenie-Prophylaxe · 1.800 kcal",
    kcal: 1800,
    slots: [
      { type: "fruehstueck", entries: [{ itemId: "r-quark", amount: 1 }] },
      { type: "snack_vormittag", entries: [{ itemId: "f-ei", amount: 120 }] },
      { type: "mittagessen", entries: [{ itemId: "r-wok", amount: 1 }] },
      { type: "snack_nachmittag", entries: [{ itemId: "f-magerquark", amount: 200 }] },
      { type: "abendessen", entries: [{ itemId: "f-lachs", amount: 150 }, { itemId: "f-feldsalat", amount: 80 }, { itemId: "f-olivenoel", amount: 10 }] },
    ],
  },
  {
    id: "t-vegetarisch",
    name: "Vegetarisch ausgewogen",
    indication: "Ovo-lacto · 2.000 kcal",
    kcal: 2000,
    slots: [
      { type: "fruehstueck", entries: [{ itemId: "f-haferflocken", amount: 70 }, { itemId: "f-milch", amount: 200 }, { itemId: "f-banane", amount: 120 }] },
      { type: "snack_vormittag", entries: [{ itemId: "f-fruchtjoghurt", amount: 150 }] },
      { type: "mittagessen", entries: [{ itemId: "r-bolo", amount: 1 }] },
      { type: "snack_nachmittag", entries: [{ itemId: "f-apfel", amount: 130 }, { itemId: "f-walnuesse", amount: 20 }] },
      { type: "abendessen", entries: [{ itemId: "f-vollkornbrot", amount: 100 }, { itemId: "f-gouda", amount: 40 }, { itemId: "f-tomate", amount: 120 }] },
    ],
  },
]

export interface DemoTarget {
  key: NutrientKey
  label: string
  short: string
  unit: string
  goal: number
  /** Ballaststoffe are a floor, not a ceiling — "over" is not a problem there. */
  direction: "range" | "atLeast"
}

/** Macro targets of the demo diet line ("Mediterran · 2.100 kcal"). */
export const DEMO_MACRO_TARGETS: DemoTarget[] = [
  { key: "kcal", label: "Energie", short: "kcal", unit: "kcal", goal: 2100, direction: "range" },
  { key: "protein", label: "Eiweiß", short: "Eiweiß", unit: "g", goal: 105, direction: "range" },
  { key: "carbs", label: "Kohlenhydrate", short: "KH", unit: "g", goal: 236, direction: "range" },
  { key: "fat", label: "Fett", short: "Fett", unit: "g", goal: 70, direction: "range" },
  { key: "fiber", label: "Ballaststoffe", short: "Ballast.", unit: "g", goal: 30, direction: "atLeast" },
]

/** DGE reference values for the demo patient (Frau, 54 Jahre). */
export const DEMO_MICRO_TARGETS: DemoTarget[] = [
  { key: "calcium", label: "Calcium", short: "Calcium", unit: "mg", goal: 1000, direction: "atLeast" },
  { key: "iron", label: "Eisen", short: "Eisen", unit: "mg", goal: 10, direction: "atLeast" },
  { key: "vitaminC", label: "Vitamin C", short: "Vit. C", unit: "mg", goal: 95, direction: "atLeast" },
  { key: "vitaminD", label: "Vitamin D", short: "Vit. D", unit: "µg", goal: 20, direction: "atLeast" },
  { key: "magnesium", label: "Magnesium", short: "Magnesium", unit: "mg", goal: 300, direction: "atLeast" },
  { key: "potassium", label: "Kalium", short: "Kalium", unit: "mg", goal: 4000, direction: "atLeast" },
]

export interface DemoPatient {
  name: string
  initials: string
  age: number
  indication: string
  dietStyle: string
  allergens: string[]
  exclusions: string[]
  goal: string
  weight: number
  targetWeight: number
  energyRequirement: number
}

export const DEMO_PATIENT: DemoPatient = {
  name: "Anna Berger",
  initials: "AB",
  age: 54,
  indication: "Typ-2-Diabetes",
  dietStyle: "Mischkost",
  allergens: ["Schalenfrüchte"],
  exclusions: ["Schweinefleisch"],
  goal: "Gewicht reduzieren",
  weight: 84,
  targetWeight: 76,
  energyRequirement: 2350,
}

export const DEMO_DIET_LINES = [
  { id: "d-mediterran", name: "Mediterran · 2.100 kcal" },
  { id: "d-diabetes", name: "Diabetes Typ 2 · 1.900 kcal" },
  { id: "d-reduktion", name: "Reduktionskost · 1.600 kcal" },
  { id: "d-eiweiss", name: "Eiweißreich · 2.000 kcal" },
]

/** The demo week, Monday-first. Index 0 = Montag. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const WEEKDAY_LONG = [
  "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag",
]
export const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

export interface DemoEntry {
  id: string
  itemId: string
  amount: number
}

export type DemoDay = Record<DemoSlotType, DemoEntry[]>

export function emptyDay(): DemoDay {
  return {
    fruehstueck: [],
    snack_vormittag: [],
    mittagessen: [],
    snack_nachmittag: [],
    abendessen: [],
  }
}

let entryCounter = 0
export function nextEntryId(): string {
  entryCounter += 1
  return `demo-entry-${entryCounter}`
}

function buildDay(rows: Array<[DemoSlotType, string, number]>): DemoDay {
  const day = emptyDay()
  for (const [slot, itemId, amount] of rows) {
    day[slot].push({ id: nextEntryId(), itemId, amount })
  }
  return day
}

/**
 * Seed week. Thursday (index 3) is the day the drafts open on: deliberately a
 * *good but unfinished* plan — energy and protein short of target, fibre above
 * it — so every draft has something real to show in its target readout.
 */
export function createDemoWeek(): Record<DayIndex, DemoDay> {
  return {
    0: buildDay([
      ["fruehstueck", "r-oats", 1],
      ["snack_vormittag", "f-banane", 120],
      ["mittagessen", "r-bolo", 1],
      ["snack_nachmittag", "f-naturjoghurt", 150],
      ["abendessen", "f-vollkornbrot", 100], ["abendessen", "f-gouda", 40], ["abendessen", "f-tomate", 120],
    ]),
    1: buildDay([
      ["fruehstueck", "r-ruehrei", 1],
      ["snack_vormittag", "f-apfel", 130],
      ["mittagessen", "r-wok", 1],
      ["snack_nachmittag", "f-magerquark", 150], ["snack_nachmittag", "f-heidelbeeren", 80],
      ["abendessen", "r-suppe", 1], ["abendessen", "f-knaeckebrot", 40],
    ]),
    2: buildDay([
      ["fruehstueck", "f-haferflocken", 70], ["fruehstueck", "f-milch", 200], ["fruehstueck", "f-heidelbeeren", 80],
      ["mittagessen", "r-bowl", 1],
      ["snack_nachmittag", "f-apfel", 130], ["snack_nachmittag", "f-walnuesse", 20],
      ["abendessen", "f-haehnchen", 150], ["abendessen", "f-brokkoli", 200], ["abendessen", "f-kartoffeln", 200],
    ]),
    3: buildDay([
      ["fruehstueck", "r-oats", 1],
      ["snack_vormittag", "f-apfel", 130], ["snack_vormittag", "f-mandeln", 20],
      ["mittagessen", "r-lachs", 1],
      ["snack_nachmittag", "f-magerquark", 150], ["snack_nachmittag", "f-heidelbeeren", 80],
      ["abendessen", "f-vollkornbrot", 120], ["abendessen", "f-frischkaese", 30],
      ["abendessen", "f-paprika", 120], ["abendessen", "f-feldsalat", 60], ["abendessen", "f-olivenoel", 5],
    ]),
    4: buildDay([
      ["fruehstueck", "r-quark", 1],
      ["mittagessen", "r-suppe", 1], ["mittagessen", "f-vollkornbrot", 60],
      ["abendessen", "r-wok", 1],
    ]),
    5: emptyDay(),
    6: emptyDay(),
  }
}

/** Nutrients contributed by one entry, scaled from the item's reference amount. */
export function entryNutrients(entry: DemoEntry): Nutrients {
  const item = DEMO_ITEM_MAP.get(entry.itemId)
  if (!item) return { ...EMPTY_NUTRIENTS }
  const factor = entry.amount / item.base
  const result = { ...EMPTY_NUTRIENTS }
  for (const key of NUTRIENT_KEYS) {
    result[key] = item.nutrients[key] * factor
  }
  return result
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const result = { ...EMPTY_NUTRIENTS }
  for (const nutrients of list) {
    for (const key of NUTRIENT_KEYS) {
      result[key] += nutrients[key]
    }
  }
  return result
}

export function slotNutrients(entries: DemoEntry[]): Nutrients {
  return sumNutrients(entries.map(entryNutrients))
}

export function dayNutrients(day: DemoDay): Nutrients {
  return sumNutrients(DEMO_SLOT_ORDER.flatMap((slot) => day[slot].map(entryNutrients)))
}

export type TargetStatus = "low" | "ok" | "high"

export interface TargetReading {
  target: DemoTarget
  value: number
  goal: number
  /** Share of the goal, uncapped — the bars clamp, the label does not. */
  ratio: number
  status: TargetStatus
  remaining: number
}

/** Under 90 % is short, over 110 % is over — except where the goal is a floor. */
export function readTarget(target: DemoTarget, value: number): TargetReading {
  const ratio = target.goal > 0 ? value / target.goal : 0
  let status: TargetStatus = "ok"
  if (ratio < 0.9) status = "low"
  else if (ratio > 1.1 && target.direction === "range") status = "high"
  return {
    target,
    value,
    goal: target.goal,
    ratio,
    status,
    remaining: target.goal - value,
  }
}

export function readTargets(targets: DemoTarget[], nutrients: Nutrients): TargetReading[] {
  return targets.map((target) => readTarget(target, nutrients[target.key]))
}

/** Allergens in the plan that the demo patient reacts to. */
export function planAllergenConflicts(day: DemoDay): Array<{ entryId: string; item: DemoItem; allergens: string[] }> {
  const conflicts: Array<{ entryId: string; item: DemoItem; allergens: string[] }> = []
  for (const slot of DEMO_SLOT_ORDER) {
    for (const entry of day[slot]) {
      const item = DEMO_ITEM_MAP.get(entry.itemId)
      if (!item?.allergens) continue
      const hits = item.allergens.filter((allergen) => DEMO_PATIENT.allergens.includes(allergen))
      if (hits.length > 0) conflicts.push({ entryId: entry.id, item, allergens: hits })
    }
  }
  return conflicts
}

/** Additive E-numbers present in the plan. */
export function planAdditives(day: DemoDay): string[] {
  const codes = new Set<string>()
  for (const slot of DEMO_SLOT_ORDER) {
    for (const entry of day[slot]) {
      for (const code of DEMO_ITEM_MAP.get(entry.itemId)?.additives ?? []) codes.add(code)
    }
  }
  return Array.from(codes).sort()
}

/**
 * Fill suggestions: the items that close the largest open target best without
 * blowing the energy budget. Deliberately simple — the drafts need something
 * plausible to render, the real generator lives in `use-plan-analysis`.
 */
export interface FillSuggestion {
  item: DemoItem
  amount: number
  slot: DemoSlotType
  /** Which target this closes, e.g. "Eiweiß". */
  closes: string
  kcal: number
  gain: number
  unit: string
}

export function fillSuggestions(day: DemoDay): FillSuggestion[] {
  const totals = dayNutrients(day)
  const openMacros = readTargets(DEMO_MACRO_TARGETS, totals)
    .filter((reading) => reading.status === "low" && reading.target.key !== "kcal")
    .sort((a, b) => a.ratio - b.ratio)

  const kcalReading = readTarget(DEMO_MACRO_TARGETS[0], totals.kcal)
  const kcalHeadroom = Math.max(0, kcalReading.remaining)

  const suggestions: FillSuggestion[] = []
  const used = new Set<string>()

  for (const reading of openMacros) {
    const key = reading.target.key
    const candidates = DEMO_ITEMS
      .filter((item) => !used.has(item.id))
      .filter((item) => !item.allergens?.some((a) => DEMO_PATIENT.allergens.includes(a)))
      .map((item) => {
        const amount = item.step
        const factor = amount / item.base
        return {
          item,
          amount,
          gain: item.nutrients[key] * factor,
          kcal: item.nutrients.kcal * factor,
        }
      })
      .filter((candidate) => candidate.gain > 0 && candidate.kcal <= Math.max(180, kcalHeadroom))
      // Best gain per kcal spent — the counselor's actual question.
      .sort((a, b) => b.gain / Math.max(1, b.kcal) - a.gain / Math.max(1, a.kcal))

    const best = candidates[0]
    if (!best) continue
    used.add(best.item.id)
    suggestions.push({
      item: best.item,
      amount: best.amount,
      slot: best.item.kind === "recipe" ? "mittagessen" : "snack_nachmittag",
      closes: reading.target.label,
      kcal: Math.round(best.kcal),
      gain: best.gain,
      unit: reading.target.unit,
    })
    if (suggestions.length >= 3) break
  }

  return suggestions
}
