import { Food, NutrientValue } from "@/lib/types";

const ts = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

/** Helper to build a full nutrient array for a food per 100g */
function n(values: Record<string, number>): NutrientValue[] {
  const ids = [
    "energie", "eiweiss", "fett", "kohlenhydrate", "ballaststoffe", "zucker",
    "gesaettigte_fettsaeuren", "ungesaettigte_fettsaeuren", "wasser",
    "vitamin_a", "vitamin_b1", "vitamin_b2", "vitamin_b6", "vitamin_b12",
    "vitamin_c", "vitamin_d", "vitamin_e", "folsaeure", "niacin",
    "calcium", "eisen", "magnesium", "kalium", "natrium", "zink", "phosphor", "jod",
  ];
  return ids.map((id) => ({ nutrientId: id, amount: values[id] ?? 0 }));
}

export const FOODS: Food[] = [
  // Gemuese
  {
    id: "food_karotte", name: "Karotte", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 36, eiweiss: 0.9, fett: 0.2, kohlenhydrate: 7.6, ballaststoffe: 2.8, zucker: 4.7,
      gesaettigte_fettsaeuren: 0.03, ungesaettigte_fettsaeuren: 0.1, wasser: 88,
      vitamin_a: 835, vitamin_b1: 0.07, vitamin_b2: 0.06, vitamin_b6: 0.14, vitamin_b12: 0,
      vitamin_c: 5.9, vitamin_d: 0, vitamin_e: 0.66, folsaeure: 19, niacin: 1.0,
      calcium: 33, eisen: 0.3, magnesium: 12, kalium: 320, natrium: 69, zink: 0.24, phosphor: 35, jod: 3,
    }),
  },
  {
    id: "food_brokkoli", name: "Brokkoli", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 34, eiweiss: 2.8, fett: 0.4, kohlenhydrate: 4.4, ballaststoffe: 3.0, zucker: 1.7,
      gesaettigte_fettsaeuren: 0.04, ungesaettigte_fettsaeuren: 0.2, wasser: 89,
      vitamin_a: 31, vitamin_b1: 0.07, vitamin_b2: 0.12, vitamin_b6: 0.18, vitamin_b12: 0,
      vitamin_c: 89, vitamin_d: 0, vitamin_e: 0.78, folsaeure: 63, niacin: 0.64,
      calcium: 47, eisen: 0.73, magnesium: 21, kalium: 316, natrium: 33, zink: 0.41, phosphor: 66, jod: 3,
    }),
  },
  {
    id: "food_tomate", name: "Tomate", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 18, eiweiss: 0.9, fett: 0.2, kohlenhydrate: 2.6, ballaststoffe: 1.2, zucker: 2.6,
      gesaettigte_fettsaeuren: 0.03, ungesaettigte_fettsaeuren: 0.1, wasser: 95,
      vitamin_a: 42, vitamin_b1: 0.04, vitamin_b2: 0.02, vitamin_b6: 0.08, vitamin_b12: 0,
      vitamin_c: 14, vitamin_d: 0, vitamin_e: 0.54, folsaeure: 15, niacin: 0.59,
      calcium: 10, eisen: 0.27, magnesium: 11, kalium: 237, natrium: 5, zink: 0.17, phosphor: 24, jod: 1,
    }),
  },
  {
    id: "food_spinat", name: "Spinat", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 23, eiweiss: 2.9, fett: 0.4, kohlenhydrate: 1.4, ballaststoffe: 2.2, zucker: 0.4,
      gesaettigte_fettsaeuren: 0.06, ungesaettigte_fettsaeuren: 0.2, wasser: 91,
      vitamin_a: 469, vitamin_b1: 0.08, vitamin_b2: 0.19, vitamin_b6: 0.20, vitamin_b12: 0,
      vitamin_c: 28, vitamin_d: 0, vitamin_e: 2.0, folsaeure: 194, niacin: 0.72,
      calcium: 99, eisen: 2.7, magnesium: 79, kalium: 558, natrium: 79, zink: 0.53, phosphor: 49, jod: 12,
    }),
  },
  {
    id: "food_paprika", name: "Paprika (rot)", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 31, eiweiss: 1.0, fett: 0.3, kohlenhydrate: 4.2, ballaststoffe: 2.1, zucker: 4.2,
      gesaettigte_fettsaeuren: 0.03, ungesaettigte_fettsaeuren: 0.15, wasser: 92,
      vitamin_a: 157, vitamin_b1: 0.05, vitamin_b2: 0.09, vitamin_b6: 0.29, vitamin_b12: 0,
      vitamin_c: 128, vitamin_d: 0, vitamin_e: 1.58, folsaeure: 46, niacin: 0.98,
      calcium: 7, eisen: 0.43, magnesium: 12, kalium: 211, natrium: 4, zink: 0.25, phosphor: 26, jod: 1,
    }),
  },
  {
    id: "food_zucchini", name: "Zucchini", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 17, eiweiss: 1.2, fett: 0.3, kohlenhydrate: 1.8, ballaststoffe: 1.0, zucker: 1.7,
      gesaettigte_fettsaeuren: 0.08, ungesaettigte_fettsaeuren: 0.1, wasser: 95,
      vitamin_a: 10, vitamin_b1: 0.05, vitamin_b2: 0.09, vitamin_b6: 0.16, vitamin_b12: 0,
      vitamin_c: 18, vitamin_d: 0, vitamin_e: 0.12, folsaeure: 24, niacin: 0.45,
      calcium: 16, eisen: 0.37, magnesium: 18, kalium: 261, natrium: 8, zink: 0.32, phosphor: 38, jod: 2,
    }),
  },
  {
    id: "food_blumenkohl", name: "Blumenkohl", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 25, eiweiss: 1.9, fett: 0.3, kohlenhydrate: 2.9, ballaststoffe: 2.0, zucker: 1.9,
      gesaettigte_fettsaeuren: 0.04, ungesaettigte_fettsaeuren: 0.15, wasser: 92,
      vitamin_a: 0, vitamin_b1: 0.05, vitamin_b2: 0.06, vitamin_b6: 0.18, vitamin_b12: 0,
      vitamin_c: 48, vitamin_d: 0, vitamin_e: 0.08, folsaeure: 57, niacin: 0.51,
      calcium: 22, eisen: 0.42, magnesium: 15, kalium: 299, natrium: 30, zink: 0.27, phosphor: 44, jod: 3,
    }),
  },
  {
    id: "food_gurke", name: "Gurke", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 12, eiweiss: 0.6, fett: 0.1, kohlenhydrate: 1.8, ballaststoffe: 0.5, zucker: 1.7,
      gesaettigte_fettsaeuren: 0.01, ungesaettigte_fettsaeuren: 0.05, wasser: 96,
      vitamin_a: 5, vitamin_b1: 0.03, vitamin_b2: 0.03, vitamin_b6: 0.04, vitamin_b12: 0,
      vitamin_c: 2.8, vitamin_d: 0, vitamin_e: 0.03, folsaeure: 7, niacin: 0.1,
      calcium: 16, eisen: 0.28, magnesium: 13, kalium: 147, natrium: 2, zink: 0.2, phosphor: 24, jod: 1,
    }),
  },
  {
    id: "food_kartoffel", name: "Kartoffel (gekocht)", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 73, eiweiss: 2.0, fett: 0.1, kohlenhydrate: 15.4, ballaststoffe: 2.2, zucker: 0.8,
      gesaettigte_fettsaeuren: 0.03, ungesaettigte_fettsaeuren: 0.04, wasser: 79,
      vitamin_a: 0, vitamin_b1: 0.08, vitamin_b2: 0.02, vitamin_b6: 0.30, vitamin_b12: 0,
      vitamin_c: 7.4, vitamin_d: 0, vitamin_e: 0.01, folsaeure: 10, niacin: 1.3,
      calcium: 8, eisen: 0.31, magnesium: 20, kalium: 379, natrium: 4, zink: 0.27, phosphor: 40, jod: 4,
    }),
  },
  {
    id: "food_zwiebel", name: "Zwiebel", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 40, eiweiss: 1.1, fett: 0.1, kohlenhydrate: 7.6, ballaststoffe: 1.7, zucker: 4.2,
      gesaettigte_fettsaeuren: 0.02, ungesaettigte_fettsaeuren: 0.05, wasser: 89,
      vitamin_a: 0, vitamin_b1: 0.05, vitamin_b2: 0.03, vitamin_b6: 0.12, vitamin_b12: 0,
      vitamin_c: 7.4, vitamin_d: 0, vitamin_e: 0.02, folsaeure: 19, niacin: 0.12,
      calcium: 23, eisen: 0.21, magnesium: 10, kalium: 146, natrium: 4, zink: 0.17, phosphor: 29, jod: 2,
    }),
  },
  // Obst
  {
    id: "food_apfel", name: "Apfel", categoryId: "cat_obst", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 52, eiweiss: 0.3, fett: 0.2, kohlenhydrate: 11.4, ballaststoffe: 2.4, zucker: 10.4,
      gesaettigte_fettsaeuren: 0.03, ungesaettigte_fettsaeuren: 0.06, wasser: 86,
      vitamin_a: 3, vitamin_b1: 0.02, vitamin_b2: 0.03, vitamin_b6: 0.04, vitamin_b12: 0,
      vitamin_c: 4.6, vitamin_d: 0, vitamin_e: 0.18, folsaeure: 3, niacin: 0.09,
      calcium: 6, eisen: 0.12, magnesium: 5, kalium: 107, natrium: 1, zink: 0.04, phosphor: 11, jod: 2,
    }),
  },
  {
    id: "food_banane", name: "Banane", categoryId: "cat_obst", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 89, eiweiss: 1.1, fett: 0.3, kohlenhydrate: 20.2, ballaststoffe: 2.6, zucker: 12.2,
      gesaettigte_fettsaeuren: 0.11, ungesaettigte_fettsaeuren: 0.07, wasser: 75,
      vitamin_a: 3, vitamin_b1: 0.03, vitamin_b2: 0.07, vitamin_b6: 0.37, vitamin_b12: 0,
      vitamin_c: 8.7, vitamin_d: 0, vitamin_e: 0.10, folsaeure: 20, niacin: 0.67,
      calcium: 5, eisen: 0.26, magnesium: 27, kalium: 358, natrium: 1, zink: 0.15, phosphor: 22, jod: 3,
    }),
  },
  {
    id: "food_erdbeere", name: "Erdbeere", categoryId: "cat_obst", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 32, eiweiss: 0.7, fett: 0.3, kohlenhydrate: 5.5, ballaststoffe: 2.0, zucker: 4.9,
      gesaettigte_fettsaeuren: 0.02, ungesaettigte_fettsaeuren: 0.17, wasser: 91,
      vitamin_a: 1, vitamin_b1: 0.02, vitamin_b2: 0.02, vitamin_b6: 0.05, vitamin_b12: 0,
      vitamin_c: 59, vitamin_d: 0, vitamin_e: 0.29, folsaeure: 24, niacin: 0.39,
      calcium: 16, eisen: 0.41, magnesium: 13, kalium: 153, natrium: 1, zink: 0.14, phosphor: 24, jod: 3,
    }),
  },
  {
    id: "food_orange", name: "Orange", categoryId: "cat_obst", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 47, eiweiss: 0.9, fett: 0.1, kohlenhydrate: 9.4, ballaststoffe: 2.4, zucker: 9.4,
      gesaettigte_fettsaeuren: 0.02, ungesaettigte_fettsaeuren: 0.04, wasser: 87,
      vitamin_a: 11, vitamin_b1: 0.09, vitamin_b2: 0.04, vitamin_b6: 0.06, vitamin_b12: 0,
      vitamin_c: 53, vitamin_d: 0, vitamin_e: 0.18, folsaeure: 30, niacin: 0.28,
      calcium: 40, eisen: 0.1, magnesium: 10, kalium: 181, natrium: 0, zink: 0.07, phosphor: 14, jod: 1,
    }),
  },
  {
    id: "food_heidelbeere", name: "Heidelbeere", categoryId: "cat_obst", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 57, eiweiss: 0.7, fett: 0.3, kohlenhydrate: 11.6, ballaststoffe: 2.4, zucker: 10.0,
      gesaettigte_fettsaeuren: 0.03, ungesaettigte_fettsaeuren: 0.15, wasser: 84,
      vitamin_a: 3, vitamin_b1: 0.04, vitamin_b2: 0.04, vitamin_b6: 0.05, vitamin_b12: 0,
      vitamin_c: 10, vitamin_d: 0, vitamin_e: 0.57, folsaeure: 6, niacin: 0.42,
      calcium: 6, eisen: 0.28, magnesium: 6, kalium: 77, natrium: 1, zink: 0.16, phosphor: 12, jod: 1,
    }),
  },
  // Fleisch
  {
    id: "food_haehnchenbrust", name: "Haehnchenbrust", categoryId: "cat_fleisch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 165, eiweiss: 31.0, fett: 3.6, kohlenhydrate: 0, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 1.0, ungesaettigte_fettsaeuren: 1.8, wasser: 65,
      vitamin_a: 6, vitamin_b1: 0.07, vitamin_b2: 0.09, vitamin_b6: 0.60, vitamin_b12: 0.34,
      vitamin_c: 0, vitamin_d: 0.1, vitamin_e: 0.27, folsaeure: 4, niacin: 13.7,
      calcium: 15, eisen: 1.0, magnesium: 29, kalium: 256, natrium: 74, zink: 1.0, phosphor: 228, jod: 3,
    }),
  },
  {
    id: "food_rinderfilet", name: "Rinderfilet", categoryId: "cat_fleisch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 218, eiweiss: 26.1, fett: 12.7, kohlenhydrate: 0, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 5.3, ungesaettigte_fettsaeuren: 5.7, wasser: 60,
      vitamin_a: 0, vitamin_b1: 0.06, vitamin_b2: 0.15, vitamin_b6: 0.37, vitamin_b12: 2.0,
      vitamin_c: 0, vitamin_d: 0.1, vitamin_e: 0.37, folsaeure: 12, niacin: 5.4,
      calcium: 6, eisen: 2.6, magnesium: 24, kalium: 335, natrium: 55, zink: 4.4, phosphor: 198, jod: 3,
    }),
  },
  {
    id: "food_schweineschnitzel", name: "Schweineschnitzel", categoryId: "cat_fleisch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 172, eiweiss: 29.3, fett: 5.7, kohlenhydrate: 0, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 2.0, ungesaettigte_fettsaeuren: 2.8, wasser: 64,
      vitamin_a: 2, vitamin_b1: 0.83, vitamin_b2: 0.25, vitamin_b6: 0.46, vitamin_b12: 1.1,
      vitamin_c: 0, vitamin_d: 0.1, vitamin_e: 0.26, folsaeure: 5, niacin: 7.2,
      calcium: 7, eisen: 1.4, magnesium: 28, kalium: 370, natrium: 53, zink: 2.4, phosphor: 220, jod: 3,
    }),
  },
  {
    id: "food_putenbrust", name: "Putenbrust", categoryId: "cat_fleisch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 135, eiweiss: 30.0, fett: 1.5, kohlenhydrate: 0, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 0.4, ungesaettigte_fettsaeuren: 0.6, wasser: 68,
      vitamin_a: 5, vitamin_b1: 0.06, vitamin_b2: 0.11, vitamin_b6: 0.80, vitamin_b12: 0.4,
      vitamin_c: 0, vitamin_d: 0.1, vitamin_e: 0.09, folsaeure: 6, niacin: 11.8,
      calcium: 10, eisen: 0.7, magnesium: 30, kalium: 293, natrium: 68, zink: 1.6, phosphor: 213, jod: 3,
    }),
  },
  // Fisch
  {
    id: "food_lachs", name: "Lachs", categoryId: "cat_fisch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 208, eiweiss: 20.4, fett: 13.4, kohlenhydrate: 0, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 3.1, ungesaettigte_fettsaeuren: 8.1, wasser: 65,
      vitamin_a: 12, vitamin_b1: 0.23, vitamin_b2: 0.12, vitamin_b6: 0.64, vitamin_b12: 3.2,
      vitamin_c: 0, vitamin_d: 11.0, vitamin_e: 1.8, folsaeure: 25, niacin: 8.0,
      calcium: 12, eisen: 0.8, magnesium: 29, kalium: 363, natrium: 44, zink: 0.64, phosphor: 240, jod: 34,
    }),
  },
  {
    id: "food_thunfisch", name: "Thunfisch", categoryId: "cat_fisch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 144, eiweiss: 23.3, fett: 4.9, kohlenhydrate: 0, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 1.3, ungesaettigte_fettsaeuren: 2.5, wasser: 71,
      vitamin_a: 18, vitamin_b1: 0.24, vitamin_b2: 0.25, vitamin_b6: 0.46, vitamin_b12: 9.4,
      vitamin_c: 0, vitamin_d: 4.5, vitamin_e: 1.0, folsaeure: 15, niacin: 18.5,
      calcium: 16, eisen: 1.3, magnesium: 50, kalium: 252, natrium: 39, zink: 0.60, phosphor: 254, jod: 50,
    }),
  },
  {
    id: "food_kabeljau", name: "Kabeljau", categoryId: "cat_fisch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 82, eiweiss: 17.8, fett: 0.7, kohlenhydrate: 0, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 0.1, ungesaettigte_fettsaeuren: 0.3, wasser: 81,
      vitamin_a: 12, vitamin_b1: 0.08, vitamin_b2: 0.07, vitamin_b6: 0.25, vitamin_b12: 1.0,
      vitamin_c: 0, vitamin_d: 1.0, vitamin_e: 0.37, folsaeure: 7, niacin: 2.1,
      calcium: 16, eisen: 0.38, magnesium: 32, kalium: 413, natrium: 78, zink: 0.45, phosphor: 203, jod: 120,
    }),
  },
  {
    id: "food_garnelen", name: "Garnelen", categoryId: "cat_fisch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 99, eiweiss: 20.9, fett: 1.7, kohlenhydrate: 0.2, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 0.3, ungesaettigte_fettsaeuren: 0.8, wasser: 76,
      vitamin_a: 54, vitamin_b1: 0.02, vitamin_b2: 0.02, vitamin_b6: 0.10, vitamin_b12: 1.1,
      vitamin_c: 2.0, vitamin_d: 0, vitamin_e: 1.32, folsaeure: 3, niacin: 2.6,
      calcium: 52, eisen: 2.4, magnesium: 37, kalium: 185, natrium: 148, zink: 1.11, phosphor: 205, jod: 35,
    }),
  },
  // Milchprodukte
  {
    id: "food_vollmilch", name: "Vollmilch (3,5 %)", categoryId: "cat_milch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 64, eiweiss: 3.3, fett: 3.5, kohlenhydrate: 4.7, ballaststoffe: 0, zucker: 4.7,
      gesaettigte_fettsaeuren: 2.3, ungesaettigte_fettsaeuren: 0.9, wasser: 87,
      vitamin_a: 28, vitamin_b1: 0.04, vitamin_b2: 0.18, vitamin_b6: 0.04, vitamin_b12: 0.4,
      vitamin_c: 1.0, vitamin_d: 0.1, vitamin_e: 0.09, folsaeure: 5, niacin: 0.09,
      calcium: 120, eisen: 0.05, magnesium: 12, kalium: 157, natrium: 44, zink: 0.38, phosphor: 92, jod: 11,
    }),
  },
  {
    id: "food_joghurt", name: "Joghurt natur (3,5 %)", categoryId: "cat_milch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 61, eiweiss: 3.5, fett: 3.5, kohlenhydrate: 3.9, ballaststoffe: 0, zucker: 3.9,
      gesaettigte_fettsaeuren: 2.3, ungesaettigte_fettsaeuren: 0.9, wasser: 88,
      vitamin_a: 28, vitamin_b1: 0.04, vitamin_b2: 0.18, vitamin_b6: 0.05, vitamin_b12: 0.4,
      vitamin_c: 0.6, vitamin_d: 0.1, vitamin_e: 0.07, folsaeure: 8, niacin: 0.12,
      calcium: 120, eisen: 0.06, magnesium: 12, kalium: 187, natrium: 50, zink: 0.41, phosphor: 95, jod: 8,
    }),
  },
  {
    id: "food_magerquark", name: "Magerquark", categoryId: "cat_milch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 67, eiweiss: 12.0, fett: 0.3, kohlenhydrate: 4.0, ballaststoffe: 0, zucker: 4.0,
      gesaettigte_fettsaeuren: 0.2, ungesaettigte_fettsaeuren: 0.07, wasser: 82,
      vitamin_a: 2, vitamin_b1: 0.03, vitamin_b2: 0.27, vitamin_b6: 0.04, vitamin_b12: 0.9,
      vitamin_c: 0.5, vitamin_d: 0, vitamin_e: 0.01, folsaeure: 22, niacin: 0.13,
      calcium: 92, eisen: 0.05, magnesium: 10, kalium: 160, natrium: 36, zink: 0.6, phosphor: 160, jod: 8,
    }),
  },
  {
    id: "food_gouda", name: "Gouda", categoryId: "cat_milch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 356, eiweiss: 24.9, fett: 27.4, kohlenhydrate: 2.2, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 17.6, ungesaettigte_fettsaeuren: 7.5, wasser: 42,
      vitamin_a: 165, vitamin_b1: 0.03, vitamin_b2: 0.33, vitamin_b6: 0.08, vitamin_b12: 1.9,
      vitamin_c: 0, vitamin_d: 0.5, vitamin_e: 0.48, folsaeure: 20, niacin: 0.04,
      calcium: 820, eisen: 0.3, magnesium: 29, kalium: 91, natrium: 819, zink: 3.9, phosphor: 460, jod: 11,
    }),
  },
  {
    id: "food_butter", name: "Butter", categoryId: "cat_milch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 717, eiweiss: 0.9, fett: 81.1, kohlenhydrate: 0.1, ballaststoffe: 0, zucker: 0.1,
      gesaettigte_fettsaeuren: 51.4, ungesaettigte_fettsaeuren: 23.4, wasser: 16,
      vitamin_a: 684, vitamin_b1: 0.01, vitamin_b2: 0.03, vitamin_b6: 0, vitamin_b12: 0.2,
      vitamin_c: 0, vitamin_d: 1.5, vitamin_e: 2.32, folsaeure: 3, niacin: 0.04,
      calcium: 24, eisen: 0.02, magnesium: 2, kalium: 24, natrium: 11, zink: 0.09, phosphor: 24, jod: 4,
    }),
  },
  // Getreide
  {
    id: "food_haferflocken", name: "Haferflocken", categoryId: "cat_getreide", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 379, eiweiss: 13.2, fett: 6.5, kohlenhydrate: 58.7, ballaststoffe: 10.6, zucker: 0.9,
      gesaettigte_fettsaeuren: 1.1, ungesaettigte_fettsaeuren: 4.2, wasser: 10,
      vitamin_a: 0, vitamin_b1: 0.76, vitamin_b2: 0.14, vitamin_b6: 0.12, vitamin_b12: 0,
      vitamin_c: 0, vitamin_d: 0, vitamin_e: 1.5, folsaeure: 56, niacin: 0.96,
      calcium: 54, eisen: 4.7, magnesium: 177, kalium: 429, natrium: 2, zink: 3.97, phosphor: 523, jod: 6,
    }),
  },
  {
    id: "food_vollkornbrot", name: "Vollkornbrot", categoryId: "cat_getreide", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 213, eiweiss: 7.0, fett: 1.2, kohlenhydrate: 40.5, ballaststoffe: 6.9, zucker: 2.8,
      gesaettigte_fettsaeuren: 0.3, ungesaettigte_fettsaeuren: 0.6, wasser: 43,
      vitamin_a: 0, vitamin_b1: 0.22, vitamin_b2: 0.09, vitamin_b6: 0.18, vitamin_b12: 0,
      vitamin_c: 0, vitamin_d: 0, vitamin_e: 0.56, folsaeure: 25, niacin: 3.1,
      calcium: 30, eisen: 2.5, magnesium: 59, kalium: 235, natrium: 460, zink: 1.9, phosphor: 195, jod: 5,
    }),
  },
  {
    id: "food_reis", name: "Reis (gekocht)", categoryId: "cat_getreide", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 130, eiweiss: 2.7, fett: 0.3, kohlenhydrate: 28.2, ballaststoffe: 0.4, zucker: 0.1,
      gesaettigte_fettsaeuren: 0.1, ungesaettigte_fettsaeuren: 0.1, wasser: 68,
      vitamin_a: 0, vitamin_b1: 0.02, vitamin_b2: 0.01, vitamin_b6: 0.09, vitamin_b12: 0,
      vitamin_c: 0, vitamin_d: 0, vitamin_e: 0.04, folsaeure: 58, niacin: 0.4,
      calcium: 10, eisen: 0.2, magnesium: 12, kalium: 35, natrium: 1, zink: 0.49, phosphor: 43, jod: 1,
    }),
  },
  {
    id: "food_nudeln", name: "Nudeln (gekocht)", categoryId: "cat_getreide", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 158, eiweiss: 5.8, fett: 0.9, kohlenhydrate: 30.6, ballaststoffe: 1.8, zucker: 0.6,
      gesaettigte_fettsaeuren: 0.2, ungesaettigte_fettsaeuren: 0.3, wasser: 62,
      vitamin_a: 0, vitamin_b1: 0.02, vitamin_b2: 0.02, vitamin_b6: 0.05, vitamin_b12: 0,
      vitamin_c: 0, vitamin_d: 0, vitamin_e: 0.06, folsaeure: 7, niacin: 0.5,
      calcium: 7, eisen: 0.5, magnesium: 18, kalium: 44, natrium: 1, zink: 0.51, phosphor: 58, jod: 1,
    }),
  },
  {
    id: "food_weizenmehl", name: "Weizenmehl (Type 405)", categoryId: "cat_getreide", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 348, eiweiss: 10.3, fett: 1.0, kohlenhydrate: 72.3, ballaststoffe: 2.7, zucker: 0.3,
      gesaettigte_fettsaeuren: 0.2, ungesaettigte_fettsaeuren: 0.5, wasser: 13,
      vitamin_a: 0, vitamin_b1: 0.06, vitamin_b2: 0.03, vitamin_b6: 0.04, vitamin_b12: 0,
      vitamin_c: 0, vitamin_d: 0, vitamin_e: 0.21, folsaeure: 20, niacin: 0.67,
      calcium: 15, eisen: 1.5, magnesium: 22, kalium: 107, natrium: 2, zink: 0.7, phosphor: 108, jod: 1,
    }),
  },
  // Huelsenfruechte
  {
    id: "food_rote_linsen", name: "Rote Linsen (gekocht)", categoryId: "cat_huelsenfruechte", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 116, eiweiss: 9.0, fett: 0.4, kohlenhydrate: 16.9, ballaststoffe: 3.8, zucker: 1.8,
      gesaettigte_fettsaeuren: 0.05, ungesaettigte_fettsaeuren: 0.2, wasser: 70,
      vitamin_a: 1, vitamin_b1: 0.17, vitamin_b2: 0.07, vitamin_b6: 0.18, vitamin_b12: 0,
      vitamin_c: 1.5, vitamin_d: 0, vitamin_e: 0.11, folsaeure: 181, niacin: 1.06,
      calcium: 19, eisen: 3.3, magnesium: 36, kalium: 369, natrium: 2, zink: 1.27, phosphor: 180, jod: 2,
    }),
  },
  {
    id: "food_kichererbsen", name: "Kichererbsen (gekocht)", categoryId: "cat_huelsenfruechte", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 164, eiweiss: 8.9, fett: 2.6, kohlenhydrate: 22.5, ballaststoffe: 7.6, zucker: 4.8,
      gesaettigte_fettsaeuren: 0.27, ungesaettigte_fettsaeuren: 1.6, wasser: 60,
      vitamin_a: 1, vitamin_b1: 0.12, vitamin_b2: 0.06, vitamin_b6: 0.14, vitamin_b12: 0,
      vitamin_c: 1.3, vitamin_d: 0, vitamin_e: 0.35, folsaeure: 172, niacin: 0.53,
      calcium: 49, eisen: 2.9, magnesium: 48, kalium: 291, natrium: 7, zink: 1.53, phosphor: 168, jod: 2,
    }),
  },
  {
    id: "food_kidneybohnen", name: "Kidneybohnen (gekocht)", categoryId: "cat_huelsenfruechte", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 127, eiweiss: 8.7, fett: 0.5, kohlenhydrate: 18.0, ballaststoffe: 6.4, zucker: 0.3,
      gesaettigte_fettsaeuren: 0.07, ungesaettigte_fettsaeuren: 0.3, wasser: 67,
      vitamin_a: 0, vitamin_b1: 0.16, vitamin_b2: 0.06, vitamin_b6: 0.12, vitamin_b12: 0,
      vitamin_c: 1.2, vitamin_d: 0, vitamin_e: 0.03, folsaeure: 130, niacin: 0.48,
      calcium: 28, eisen: 2.9, magnesium: 45, kalium: 403, natrium: 2, zink: 1.07, phosphor: 142, jod: 2,
    }),
  },
  // Nuesse & Samen
  {
    id: "food_mandeln", name: "Mandeln", categoryId: "cat_nuesse", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 579, eiweiss: 21.2, fett: 49.9, kohlenhydrate: 9.1, ballaststoffe: 12.5, zucker: 4.4,
      gesaettigte_fettsaeuren: 3.7, ungesaettigte_fettsaeuren: 40.6, wasser: 4,
      vitamin_a: 0, vitamin_b1: 0.21, vitamin_b2: 1.14, vitamin_b6: 0.14, vitamin_b12: 0,
      vitamin_c: 0, vitamin_d: 0, vitamin_e: 25.6, folsaeure: 44, niacin: 3.6,
      calcium: 269, eisen: 3.7, magnesium: 270, kalium: 733, natrium: 1, zink: 3.12, phosphor: 481, jod: 2,
    }),
  },
  {
    id: "food_walnuesse", name: "Walnuesse", categoryId: "cat_nuesse", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 654, eiweiss: 15.2, fett: 65.2, kohlenhydrate: 7.0, ballaststoffe: 6.7, zucker: 2.6,
      gesaettigte_fettsaeuren: 6.1, ungesaettigte_fettsaeuren: 53.9, wasser: 4,
      vitamin_a: 1, vitamin_b1: 0.34, vitamin_b2: 0.15, vitamin_b6: 0.54, vitamin_b12: 0,
      vitamin_c: 1.3, vitamin_d: 0, vitamin_e: 0.7, folsaeure: 98, niacin: 1.1,
      calcium: 98, eisen: 2.9, magnesium: 158, kalium: 441, natrium: 2, zink: 3.09, phosphor: 346, jod: 3,
    }),
  },
  {
    id: "food_cashews", name: "Cashews", categoryId: "cat_nuesse", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 553, eiweiss: 18.2, fett: 43.9, kohlenhydrate: 26.9, ballaststoffe: 3.3, zucker: 5.9,
      gesaettigte_fettsaeuren: 7.8, ungesaettigte_fettsaeuren: 31.4, wasser: 5,
      vitamin_a: 0, vitamin_b1: 0.42, vitamin_b2: 0.06, vitamin_b6: 0.42, vitamin_b12: 0,
      vitamin_c: 0.5, vitamin_d: 0, vitamin_e: 0.9, folsaeure: 25, niacin: 1.1,
      calcium: 37, eisen: 6.7, magnesium: 292, kalium: 660, natrium: 12, zink: 5.78, phosphor: 593, jod: 10,
    }),
  },
  // Oele & Fette
  {
    id: "food_olivenoel", name: "Olivenoel", categoryId: "cat_oele", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 884, eiweiss: 0, fett: 100, kohlenhydrate: 0, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 13.8, ungesaettigte_fettsaeuren: 80.2, wasser: 0,
      vitamin_a: 0, vitamin_b1: 0, vitamin_b2: 0, vitamin_b6: 0, vitamin_b12: 0,
      vitamin_c: 0, vitamin_d: 0, vitamin_e: 14.4, folsaeure: 0, niacin: 0,
      calcium: 1, eisen: 0.56, magnesium: 0, kalium: 1, natrium: 2, zink: 0, phosphor: 0, jod: 0,
    }),
  },
  {
    id: "food_rapsoel", name: "Rapsoel", categoryId: "cat_oele", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 884, eiweiss: 0, fett: 100, kohlenhydrate: 0, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 7.4, ungesaettigte_fettsaeuren: 85.6, wasser: 0,
      vitamin_a: 0, vitamin_b1: 0, vitamin_b2: 0, vitamin_b6: 0, vitamin_b12: 0,
      vitamin_c: 0, vitamin_d: 0, vitamin_e: 18.9, folsaeure: 0, niacin: 0,
      calcium: 0, eisen: 0, magnesium: 0, kalium: 0, natrium: 0, zink: 0, phosphor: 0, jod: 0,
    }),
  },
  // Getraenke
  {
    id: "food_orangensaft", name: "Orangensaft", categoryId: "cat_getraenke", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 45, eiweiss: 0.7, fett: 0.2, kohlenhydrate: 9.3, ballaststoffe: 0.2, zucker: 8.4,
      gesaettigte_fettsaeuren: 0.02, ungesaettigte_fettsaeuren: 0.04, wasser: 89,
      vitamin_a: 4, vitamin_b1: 0.09, vitamin_b2: 0.03, vitamin_b6: 0.04, vitamin_b12: 0,
      vitamin_c: 50, vitamin_d: 0, vitamin_e: 0.04, folsaeure: 30, niacin: 0.4,
      calcium: 11, eisen: 0.2, magnesium: 11, kalium: 200, natrium: 1, zink: 0.05, phosphor: 17, jod: 1,
    }),
  },
  // Additional common foods
  {
    id: "food_ei", name: "Huehnerei (gekocht)", categoryId: "cat_milch", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 155, eiweiss: 12.6, fett: 10.6, kohlenhydrate: 1.1, ballaststoffe: 0, zucker: 1.1,
      gesaettigte_fettsaeuren: 3.3, ungesaettigte_fettsaeuren: 5.5, wasser: 75,
      vitamin_a: 160, vitamin_b1: 0.07, vitamin_b2: 0.51, vitamin_b6: 0.12, vitamin_b12: 1.1,
      vitamin_c: 0, vitamin_d: 2.0, vitamin_e: 1.05, folsaeure: 47, niacin: 0.07,
      calcium: 50, eisen: 1.8, magnesium: 12, kalium: 126, natrium: 124, zink: 1.29, phosphor: 198, jod: 10,
    }),
  },
  {
    id: "food_honig", name: "Honig", categoryId: "cat_getraenke", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 304, eiweiss: 0.3, fett: 0, kohlenhydrate: 75.1, ballaststoffe: 0.2, zucker: 75.1,
      gesaettigte_fettsaeuren: 0, ungesaettigte_fettsaeuren: 0, wasser: 17,
      vitamin_a: 0, vitamin_b1: 0, vitamin_b2: 0.04, vitamin_b6: 0.02, vitamin_b12: 0,
      vitamin_c: 0.5, vitamin_d: 0, vitamin_e: 0, folsaeure: 2, niacin: 0.12,
      calcium: 6, eisen: 0.42, magnesium: 2, kalium: 52, natrium: 4, zink: 0.22, phosphor: 4, jod: 1,
    }),
  },
  {
    id: "food_salz", name: "Speisesalz", categoryId: "cat_oele", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 0, eiweiss: 0, fett: 0, kohlenhydrate: 0, ballaststoffe: 0, zucker: 0,
      gesaettigte_fettsaeuren: 0, ungesaettigte_fettsaeuren: 0, wasser: 0.2,
      vitamin_a: 0, vitamin_b1: 0, vitamin_b2: 0, vitamin_b6: 0, vitamin_b12: 0,
      vitamin_c: 0, vitamin_d: 0, vitamin_e: 0, folsaeure: 0, niacin: 0,
      calcium: 24, eisen: 0.33, magnesium: 1, kalium: 8, natrium: 38758, zink: 0.1, phosphor: 0, jod: 1500,
    }),
  },
  {
    id: "food_zucker", name: "Zucker (weiss)", categoryId: "cat_getraenke", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 400, eiweiss: 0, fett: 0, kohlenhydrate: 100, ballaststoffe: 0, zucker: 100,
      gesaettigte_fettsaeuren: 0, ungesaettigte_fettsaeuren: 0, wasser: 0,
      vitamin_a: 0, vitamin_b1: 0, vitamin_b2: 0, vitamin_b6: 0, vitamin_b12: 0,
      vitamin_c: 0, vitamin_d: 0, vitamin_e: 0, folsaeure: 0, niacin: 0,
      calcium: 1, eisen: 0.05, magnesium: 0, kalium: 2, natrium: 0, zink: 0.01, phosphor: 0, jod: 0,
    }),
  },
  {
    id: "food_knoblauch", name: "Knoblauch", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 149, eiweiss: 6.4, fett: 0.5, kohlenhydrate: 28.2, ballaststoffe: 2.1, zucker: 1.0,
      gesaettigte_fettsaeuren: 0.09, ungesaettigte_fettsaeuren: 0.25, wasser: 59,
      vitamin_a: 0, vitamin_b1: 0.20, vitamin_b2: 0.11, vitamin_b6: 1.24, vitamin_b12: 0,
      vitamin_c: 31, vitamin_d: 0, vitamin_e: 0.01, folsaeure: 3, niacin: 0.7,
      calcium: 181, eisen: 1.7, magnesium: 25, kalium: 401, natrium: 17, zink: 1.16, phosphor: 153, jod: 3,
    }),
  },
  {
    id: "food_petersilie", name: "Petersilie", categoryId: "cat_gemuese", source: "BLS 3.02", baseAmount: 100, ...ts,
    nutrients: n({
      energie: 36, eiweiss: 3.0, fett: 0.8, kohlenhydrate: 3.0, ballaststoffe: 3.3, zucker: 0.9,
      gesaettigte_fettsaeuren: 0.13, ungesaettigte_fettsaeuren: 0.45, wasser: 88,
      vitamin_a: 421, vitamin_b1: 0.09, vitamin_b2: 0.10, vitamin_b6: 0.09, vitamin_b12: 0,
      vitamin_c: 133, vitamin_d: 0, vitamin_e: 1.74, folsaeure: 152, niacin: 1.31,
      calcium: 138, eisen: 6.2, magnesium: 50, kalium: 554, natrium: 56, zink: 1.07, phosphor: 58, jod: 4,
    }),
  },
];
