import type { NutrientDefinition } from "@/lib/types";

export const NUTRIENT_DEFINITIONS: NutrientDefinition[] = [
  // Makronährstoffe
  { id: "energie", name: "Energie", shortName: "Energie", unit: "kcal", group: "makronaehrstoffe", sortOrder: 1 },
  { id: "energie_kj", name: "Energie (kJ)", shortName: "Energie kJ", unit: "kJ", group: "makronaehrstoffe", sortOrder: 2 },
  { id: "eiweiss", name: "Eiweiß", shortName: "Eiweiß", unit: "g", group: "makronaehrstoffe", sortOrder: 3 },
  { id: "fett", name: "Fett", shortName: "Fett", unit: "g", group: "makronaehrstoffe", sortOrder: 4 },
  { id: "kohlenhydrate", name: "Kohlenhydrate", shortName: "Kohlenhydrate", unit: "g", group: "makronaehrstoffe", sortOrder: 5 },
  // Derived display nutrient (BE = kohlenhydrate / 12). Not populated by ETL —
  // computed at display time via `getBroteinheiten()`. Listed here so labels,
  // units, and compliance-target lookups resolve through the same code path.
  { id: "broteinheiten", name: "Broteinheiten", shortName: "BE", unit: "BE", group: "makronaehrstoffe", sortOrder: 12 },
  { id: "ballaststoffe", name: "Ballaststoffe", shortName: "Ballastst.", unit: "g", group: "makronaehrstoffe", sortOrder: 6 },
  { id: "zucker", name: "Zucker", shortName: "Zucker", unit: "g", group: "makronaehrstoffe", sortOrder: 7 },
  { id: "gesaettigte_fettsaeuren", name: "Gesättigte Fettsäuren", shortName: "Ges. FS", unit: "g", group: "makronaehrstoffe", sortOrder: 8 },
  { id: "ungesaettigte_fettsaeuren", name: "Ungesättigte Fettsäuren", shortName: "Unges. FS", unit: "g", group: "makronaehrstoffe", sortOrder: 9 },
  { id: "wasser", name: "Wasser", shortName: "Wasser", unit: "g", group: "makronaehrstoffe", sortOrder: 10 },
  { id: "alkohol", name: "Alkohol", shortName: "Alkohol", unit: "g", group: "makronaehrstoffe", sortOrder: 11 },

  // Vitamine
  { id: "vitamin_a", name: "Vitamin A (RE)", shortName: "Vit. A", unit: "µg", group: "vitamine", sortOrder: 20 },
  { id: "vitamin_b1", name: "Vitamin B1 (Thiamin)", shortName: "Vit. B1", unit: "mg", group: "vitamine", sortOrder: 21 },
  { id: "vitamin_b2", name: "Vitamin B2 (Riboflavin)", shortName: "Vit. B2", unit: "mg", group: "vitamine", sortOrder: 22 },
  { id: "vitamin_b6", name: "Vitamin B6", shortName: "Vit. B6", unit: "mg", group: "vitamine", sortOrder: 23 },
  { id: "vitamin_b12", name: "Vitamin B12", shortName: "Vit. B12", unit: "µg", group: "vitamine", sortOrder: 24 },
  { id: "vitamin_c", name: "Vitamin C", shortName: "Vit. C", unit: "mg", group: "vitamine", sortOrder: 25 },
  { id: "vitamin_d", name: "Vitamin D", shortName: "Vit. D", unit: "µg", group: "vitamine", sortOrder: 26 },
  { id: "vitamin_e", name: "Vitamin E", shortName: "Vit. E", unit: "mg", group: "vitamine", sortOrder: 27 },
  { id: "folsaeure", name: "Folat-Äquivalent", shortName: "Folat", unit: "µg", group: "vitamine", sortOrder: 28 },
  { id: "niacin", name: "Niacin-Äquivalent", shortName: "Niacin", unit: "mg", group: "vitamine", sortOrder: 29 },
  { id: "vitamin_k", name: "Vitamin K", shortName: "Vit. K", unit: "µg", group: "vitamine", sortOrder: 30 },
  { id: "biotin", name: "Biotin", shortName: "Biotin", unit: "µg", group: "vitamine", sortOrder: 31 },
  { id: "pantothensaeure", name: "Pantothensäure", shortName: "Pantoth.", unit: "mg", group: "vitamine", sortOrder: 32 },

  // Mineralstoffe
  { id: "calcium", name: "Calcium", shortName: "Ca", unit: "mg", group: "mineralstoffe", sortOrder: 40 },
  { id: "eisen", name: "Eisen", shortName: "Fe", unit: "mg", group: "mineralstoffe", sortOrder: 41 },
  { id: "magnesium", name: "Magnesium", shortName: "Mg", unit: "mg", group: "mineralstoffe", sortOrder: 42 },
  { id: "kalium", name: "Kalium", shortName: "K", unit: "mg", group: "mineralstoffe", sortOrder: 43 },
  { id: "natrium", name: "Natrium", shortName: "Na", unit: "mg", group: "mineralstoffe", sortOrder: 44 },
  { id: "zink", name: "Zink", shortName: "Zn", unit: "mg", group: "mineralstoffe", sortOrder: 45 },
  { id: "phosphor", name: "Phosphor", shortName: "P", unit: "mg", group: "mineralstoffe", sortOrder: 46 },
  { id: "jod", name: "Jod", shortName: "J", unit: "µg", group: "mineralstoffe", sortOrder: 47 },
  { id: "kupfer", name: "Kupfer", shortName: "Cu", unit: "µg", group: "mineralstoffe", sortOrder: 48 },
  { id: "mangan", name: "Mangan", shortName: "Mn", unit: "µg", group: "mineralstoffe", sortOrder: 49 },
  { id: "fluorid", name: "Fluorid", shortName: "F", unit: "µg", group: "mineralstoffe", sortOrder: 50 },
  { id: "chlorid", name: "Chlorid", shortName: "Cl", unit: "mg", group: "mineralstoffe", sortOrder: 51 },
  { id: "salz", name: "Salz (NaCl)", shortName: "Salz", unit: "g", group: "mineralstoffe", sortOrder: 52 },

  // Vitamine (erweitert — SFK)
  { id: "beta_carotin", name: "Beta-Carotin", shortName: "β-Carotin", unit: "µg", group: "vitamine", sortOrder: 33 },
  { id: "retinol", name: "Retinol", shortName: "Retinol", unit: "µg", group: "vitamine", sortOrder: 34 },
  { id: "alpha_tocopherol", name: "Alpha-Tocopherol", shortName: "α-Tocoph.", unit: "mg", group: "vitamine", sortOrder: 35 },
  { id: "vitamin_k1", name: "Vitamin K1 (Phyllochinon)", shortName: "Vit. K1", unit: "µg", group: "vitamine", sortOrder: 36 },
  { id: "vitamin_k2", name: "Vitamin K2 (Menachinon)", shortName: "Vit. K2", unit: "µg", group: "vitamine", sortOrder: 37 },

  // Mineralstoffe (erweitert — SFK)
  { id: "selen", name: "Selen", shortName: "Se", unit: "µg", group: "mineralstoffe", sortOrder: 53 },
  { id: "chrom", name: "Chrom", shortName: "Cr", unit: "µg", group: "mineralstoffe", sortOrder: 54 },
  { id: "molybdaen", name: "Molybdän", shortName: "Mo", unit: "µg", group: "mineralstoffe", sortOrder: 55 },
  { id: "silicium", name: "Silicium", shortName: "Si", unit: "mg", group: "mineralstoffe", sortOrder: 56 },

  // Aminosäuren (SFK)
  { id: "isoleucin", name: "Isoleucin", shortName: "Ile", unit: "mg", group: "aminosaeuren", sortOrder: 100 },
  { id: "leucin", name: "Leucin", shortName: "Leu", unit: "mg", group: "aminosaeuren", sortOrder: 101 },
  { id: "lysin", name: "Lysin", shortName: "Lys", unit: "mg", group: "aminosaeuren", sortOrder: 102 },
  { id: "methionin", name: "Methionin", shortName: "Met", unit: "mg", group: "aminosaeuren", sortOrder: 103 },
  { id: "cystein", name: "Cystein", shortName: "Cys", unit: "mg", group: "aminosaeuren", sortOrder: 104 },
  { id: "phenylalanin", name: "Phenylalanin", shortName: "Phe", unit: "mg", group: "aminosaeuren", sortOrder: 105 },
  { id: "tyrosin", name: "Tyrosin", shortName: "Tyr", unit: "mg", group: "aminosaeuren", sortOrder: 106 },
  { id: "threonin", name: "Threonin", shortName: "Thr", unit: "mg", group: "aminosaeuren", sortOrder: 107 },
  { id: "tryptophan", name: "Tryptophan", shortName: "Trp", unit: "mg", group: "aminosaeuren", sortOrder: 108 },
  { id: "valin", name: "Valin", shortName: "Val", unit: "mg", group: "aminosaeuren", sortOrder: 109 },
  { id: "arginin", name: "Arginin", shortName: "Arg", unit: "mg", group: "aminosaeuren", sortOrder: 110 },
  { id: "histidin", name: "Histidin", shortName: "His", unit: "mg", group: "aminosaeuren", sortOrder: 111 },
  { id: "alanin", name: "Alanin", shortName: "Ala", unit: "mg", group: "aminosaeuren", sortOrder: 112 },
  { id: "asparaginsaeure", name: "Asparaginsäure", shortName: "Asp", unit: "mg", group: "aminosaeuren", sortOrder: 113 },
  { id: "glutaminsaeure", name: "Glutaminsäure", shortName: "Glu", unit: "mg", group: "aminosaeuren", sortOrder: 114 },
  { id: "glycin", name: "Glycin", shortName: "Gly", unit: "mg", group: "aminosaeuren", sortOrder: 115 },
  { id: "prolin", name: "Prolin", shortName: "Pro", unit: "mg", group: "aminosaeuren", sortOrder: 116 },
  { id: "serin", name: "Serin", shortName: "Ser", unit: "mg", group: "aminosaeuren", sortOrder: 117 },

  // Fettsäuren (Detail — SFK)
  { id: "laurinsaeure", name: "Laurinsäure (C12:0)", shortName: "C12:0", unit: "mg", group: "fettsaeuren", sortOrder: 200 },
  { id: "myristinsaeure", name: "Myristinsäure (C14:0)", shortName: "C14:0", unit: "mg", group: "fettsaeuren", sortOrder: 201 },
  { id: "palmitinsaeure", name: "Palmitinsäure (C16:0)", shortName: "C16:0", unit: "mg", group: "fettsaeuren", sortOrder: 202 },
  { id: "stearinsaeure", name: "Stearinsäure (C18:0)", shortName: "C18:0", unit: "mg", group: "fettsaeuren", sortOrder: 203 },
  { id: "oelsaeure", name: "Ölsäure (C18:1)", shortName: "C18:1", unit: "mg", group: "fettsaeuren", sortOrder: 204 },
  { id: "linolsaeure", name: "Linolsäure (C18:2 n-6)", shortName: "C18:2", unit: "mg", group: "fettsaeuren", sortOrder: 205 },
  { id: "linolensaeure", name: "Linolensäure (C18:3 n-3)", shortName: "C18:3", unit: "mg", group: "fettsaeuren", sortOrder: 206 },
  { id: "arachidonsaeure", name: "Arachidonsäure (C20:4 n-6)", shortName: "C20:4", unit: "mg", group: "fettsaeuren", sortOrder: 207 },
  { id: "epa", name: "EPA (C20:5 n-3)", shortName: "EPA", unit: "mg", group: "fettsaeuren", sortOrder: 208 },
  { id: "dha", name: "DHA (C22:6 n-3)", shortName: "DHA", unit: "mg", group: "fettsaeuren", sortOrder: 209 },
  { id: "trans_fettsaeuren", name: "Trans-Fettsäuren", shortName: "Trans-FS", unit: "mg", group: "fettsaeuren", sortOrder: 210 },
  { id: "omega_3_gesamt", name: "Omega-3-Fettsäuren (gesamt)", shortName: "Ω-3", unit: "mg", group: "fettsaeuren", sortOrder: 211 },
  { id: "omega_6_gesamt", name: "Omega-6-Fettsäuren (gesamt)", shortName: "Ω-6", unit: "mg", group: "fettsaeuren", sortOrder: 212 },

  // Sonstige
  { id: "cholesterin", name: "Cholesterin", shortName: "Chol.", unit: "mg", group: "sonstige", sortOrder: 60 },
  { id: "purine", name: "Purine", shortName: "Purine", unit: "mg", group: "sonstige", sortOrder: 61 },
  { id: "harnsaeure", name: "Harnsäure", shortName: "Harns.", unit: "mg", group: "sonstige", sortOrder: 62 },
  { id: "oxalsaeure", name: "Oxalsäure", shortName: "Oxals.", unit: "mg", group: "sonstige", sortOrder: 63 },
  { id: "staerke", name: "Stärke", shortName: "Stärke", unit: "g", group: "sonstige", sortOrder: 64 },
  { id: "sorbit", name: "Sorbit", shortName: "Sorbit", unit: "mg", group: "sonstige", sortOrder: 65 },
  { id: "organische_saeuren", name: "Organische Säuren", shortName: "Org. S.", unit: "g", group: "sonstige", sortOrder: 66 },
];
