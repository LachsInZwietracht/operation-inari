import { ReferenceValue } from "@/lib/types";

/**
 * DGE-Referenzwerte für die Nährstoffzufuhr (Erwachsene 25–51 Jahre)
 * Quelle: Deutsche Gesellschaft für Ernährung (DGE), Stand 2024
 */
export const REFERENCE_VALUES: ReferenceValue[] = [
  // ── Makronährstoffe ──────────────────────────────────

  // Energie – PAL 1,6 (mäßig aktiv)
  { nutrientId: "energie", amount: 2400, gender: "m", label: "Energie (Erwachsener Mann)" },
  { nutrientId: "energie", amount: 1900, gender: "w", label: "Energie (Erwachsene Frau)" },

  // Eiweiß – 0,8 g/kg KG → ~57g (M, 71kg) / ~48g (W, 60kg)
  { nutrientId: "eiweiss", amount: 57, gender: "m", label: "Eiweiß (Erwachsener Mann)" },
  { nutrientId: "eiweiss", amount: 48, gender: "w", label: "Eiweiß (Erwachsene Frau)" },

  // Fett – 30% der Energiezufuhr
  { nutrientId: "fett", amount: 80, gender: "m", label: "Fett (Erwachsener Mann)" },
  { nutrientId: "fett", amount: 63, gender: "w", label: "Fett (Erwachsene Frau)" },

  // Kohlenhydrate – >50% der Energiezufuhr
  { nutrientId: "kohlenhydrate", amount: 300, gender: "m", label: "Kohlenhydrate (Erwachsener Mann)" },
  { nutrientId: "kohlenhydrate", amount: 237, gender: "w", label: "Kohlenhydrate (Erwachsene Frau)" },

  // Ballaststoffe – mind. 30 g/Tag
  { nutrientId: "ballaststoffe", amount: 30, gender: "m", label: "Ballaststoffe (Erwachsener Mann)" },
  { nutrientId: "ballaststoffe", amount: 30, gender: "w", label: "Ballaststoffe (Erwachsene Frau)" },

  // Zucker – max. 10% der Energiezufuhr (WHO)
  { nutrientId: "zucker", amount: 60, gender: "m", label: "Zucker (Erwachsener Mann)" },
  { nutrientId: "zucker", amount: 47, gender: "w", label: "Zucker (Erwachsene Frau)" },

  // Gesättigte Fettsäuren – max. 10% der Energiezufuhr
  { nutrientId: "gesaettigte_fettsaeuren", amount: 27, gender: "m", label: "Ges. Fettsäuren (Erwachsener Mann)" },
  { nutrientId: "gesaettigte_fettsaeuren", amount: 21, gender: "w", label: "Ges. Fettsäuren (Erwachsene Frau)" },

  // Ungesättigte Fettsäuren – Orientierungswert
  { nutrientId: "ungesaettigte_fettsaeuren", amount: 53, gender: "m", label: "Unges. Fettsäuren (Erwachsener Mann)" },
  { nutrientId: "ungesaettigte_fettsaeuren", amount: 42, gender: "w", label: "Unges. Fettsäuren (Erwachsene Frau)" },

  // Wasser – 1,5 l Trinkwasser + Nahrung
  { nutrientId: "wasser", amount: 2500, gender: "m", label: "Wasser (Erwachsener Mann)" },
  { nutrientId: "wasser", amount: 2000, gender: "w", label: "Wasser (Erwachsene Frau)" },

  // ── Vitamine ─────────────────────────────────────────

  { nutrientId: "vitamin_a", amount: 850, gender: "m", label: "Vitamin A (Erwachsener Mann)" },
  { nutrientId: "vitamin_a", amount: 700, gender: "w", label: "Vitamin A (Erwachsene Frau)" },

  { nutrientId: "vitamin_b1", amount: 1.3, gender: "m", label: "Vitamin B1 (Erwachsener Mann)" },
  { nutrientId: "vitamin_b1", amount: 1.0, gender: "w", label: "Vitamin B1 (Erwachsene Frau)" },

  { nutrientId: "vitamin_b2", amount: 1.4, gender: "m", label: "Vitamin B2 (Erwachsener Mann)" },
  { nutrientId: "vitamin_b2", amount: 1.1, gender: "w", label: "Vitamin B2 (Erwachsene Frau)" },

  { nutrientId: "vitamin_b6", amount: 1.6, gender: "m", label: "Vitamin B6 (Erwachsener Mann)" },
  { nutrientId: "vitamin_b6", amount: 1.4, gender: "w", label: "Vitamin B6 (Erwachsene Frau)" },

  { nutrientId: "vitamin_b12", amount: 4.0, gender: "m", label: "Vitamin B12 (Erwachsener Mann)" },
  { nutrientId: "vitamin_b12", amount: 4.0, gender: "w", label: "Vitamin B12 (Erwachsene Frau)" },

  { nutrientId: "vitamin_c", amount: 110, gender: "m", label: "Vitamin C (Erwachsener Mann)" },
  { nutrientId: "vitamin_c", amount: 95, gender: "w", label: "Vitamin C (Erwachsene Frau)" },

  { nutrientId: "vitamin_d", amount: 20, gender: "m", label: "Vitamin D (Erwachsener Mann)" },
  { nutrientId: "vitamin_d", amount: 20, gender: "w", label: "Vitamin D (Erwachsene Frau)" },

  { nutrientId: "vitamin_e", amount: 15, gender: "m", label: "Vitamin E (Erwachsener Mann)" },
  { nutrientId: "vitamin_e", amount: 12, gender: "w", label: "Vitamin E (Erwachsene Frau)" },

  { nutrientId: "folsaeure", amount: 300, gender: "m", label: "Folsäure (Erwachsener Mann)" },
  { nutrientId: "folsaeure", amount: 300, gender: "w", label: "Folsäure (Erwachsene Frau)" },

  { nutrientId: "niacin", amount: 16, gender: "m", label: "Niacin (Erwachsener Mann)" },
  { nutrientId: "niacin", amount: 13, gender: "w", label: "Niacin (Erwachsene Frau)" },

  // ── Mineralstoffe ────────────────────────────────────

  { nutrientId: "calcium", amount: 1000, gender: "m", label: "Calcium (Erwachsener Mann)" },
  { nutrientId: "calcium", amount: 1000, gender: "w", label: "Calcium (Erwachsene Frau)" },

  { nutrientId: "eisen", amount: 10, gender: "m", label: "Eisen (Erwachsener Mann)" },
  { nutrientId: "eisen", amount: 15, gender: "w", label: "Eisen (Erwachsene Frau)" },

  { nutrientId: "magnesium", amount: 400, gender: "m", label: "Magnesium (Erwachsener Mann)" },
  { nutrientId: "magnesium", amount: 300, gender: "w", label: "Magnesium (Erwachsene Frau)" },

  { nutrientId: "kalium", amount: 4000, gender: "m", label: "Kalium (Erwachsener Mann)" },
  { nutrientId: "kalium", amount: 4000, gender: "w", label: "Kalium (Erwachsene Frau)" },

  { nutrientId: "natrium", amount: 1500, gender: "m", label: "Natrium (Erwachsener Mann)" },
  { nutrientId: "natrium", amount: 1500, gender: "w", label: "Natrium (Erwachsene Frau)" },

  { nutrientId: "zink", amount: 14, gender: "m", label: "Zink (Erwachsener Mann)" },
  { nutrientId: "zink", amount: 8, gender: "w", label: "Zink (Erwachsene Frau)" },

  { nutrientId: "phosphor", amount: 700, gender: "m", label: "Phosphor (Erwachsener Mann)" },
  { nutrientId: "phosphor", amount: 700, gender: "w", label: "Phosphor (Erwachsene Frau)" },

  { nutrientId: "jod", amount: 200, gender: "m", label: "Jod (Erwachsener Mann)" },
  { nutrientId: "jod", amount: 200, gender: "w", label: "Jod (Erwachsene Frau)" },
];
