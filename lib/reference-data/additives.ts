/**
 * Reference catalog of EU food additives (E-Nummern) with the LMIV functional
 * class and clinical flags that matter for German clinical nutrition workflows.
 *
 * Source authority: Verordnung (EG) Nr. 1333/2008 (Lebensmittelzusatzstoffe)
 * and the Lebensmittelinformationsverordnung (LMIV / VO (EU) Nr. 1169/2011).
 *
 * Clinical flags are conservatively assigned — they trigger UI hints, not
 * regulatory advice. Always cross-check with current product labelling.
 */

export type AdditiveCategoryId =
  | "color"
  | "preservative"
  | "antioxidant"
  | "acidity_regulator"
  | "thickener"
  | "emulsifier"
  | "stabilizer"
  | "anti_caking"
  | "flavor_enhancer"
  | "sweetener"
  | "sweetener_polyol"
  | "raising_agent"
  | "glazing_agent"
  | "modified_starch"
  | "other";

export type AdditiveClinicalFlag =
  | "phosphate"
  | "polyol"
  | "phenylalanine_pku"
  | "azo_dye"
  | "sulfite"
  | "glutamate"
  | "nitrite_nitrate";

export interface AdditiveCategory {
  id: AdditiveCategoryId;
  label: string;
  description: string;
  /** Tailwind class fragment used for badge backgrounds — keeps colours consistent across UI surfaces. */
  badgeClass: string;
}

export interface Additive {
  /** Canonical uppercase code, e.g. "E951". */
  code: string;
  /** German display name, e.g. "Aspartam". */
  name: string;
  categoryId: AdditiveCategoryId;
  /** Clinically relevant flags — empty array when none apply. */
  clinicalFlags: AdditiveClinicalFlag[];
  /** Short German note shown as a tooltip hint, e.g. mandatory LMIV warning. */
  notes?: string;
}

export const ADDITIVE_CATEGORIES: AdditiveCategory[] = [
  {
    id: "color",
    label: "Farbstoff",
    description: "Färbende Zusatzstoffe.",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-200",
  },
  {
    id: "preservative",
    label: "Konservierungsstoff",
    description: "Schützt vor mikrobiellem Verderb.",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-200",
  },
  {
    id: "antioxidant",
    label: "Antioxidationsmittel",
    description: "Schützt vor Oxidation und Verfärbung.",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-200",
  },
  {
    id: "acidity_regulator",
    label: "Säureregulator",
    description: "Stellt den pH-Wert ein.",
    badgeClass: "bg-lime-100 text-lime-900 border-lime-200",
  },
  {
    id: "thickener",
    label: "Verdickungsmittel",
    description: "Erhöht die Viskosität.",
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
  {
    id: "emulsifier",
    label: "Emulgator",
    description: "Verbindet nicht mischbare Phasen.",
    badgeClass: "bg-teal-100 text-teal-900 border-teal-200",
  },
  {
    id: "stabilizer",
    label: "Stabilisator",
    description: "Erhält die physikalisch-chemische Struktur.",
    badgeClass: "bg-cyan-100 text-cyan-900 border-cyan-200",
  },
  {
    id: "anti_caking",
    label: "Trennmittel",
    description: "Verhindert Verklumpung.",
    badgeClass: "bg-sky-100 text-sky-900 border-sky-200",
  },
  {
    id: "flavor_enhancer",
    label: "Geschmacksverstärker",
    description: "Verstärkt den Eigengeschmack.",
    badgeClass: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
  },
  {
    id: "sweetener",
    label: "Süßungsmittel",
    description: "Intensivsüßstoff ohne nennenswerten Energiegehalt.",
    badgeClass: "bg-pink-100 text-pink-900 border-pink-200",
  },
  {
    id: "sweetener_polyol",
    label: "Süßungsmittel (Zuckeralkohol)",
    description: "Polyol mit reduzierter Energiebilanz; abführend bei hoher Aufnahme.",
    badgeClass: "bg-pink-50 text-pink-900 border-pink-200",
  },
  {
    id: "raising_agent",
    label: "Backtriebmittel",
    description: "Lockert Teige.",
    badgeClass: "bg-yellow-100 text-yellow-900 border-yellow-200",
  },
  {
    id: "glazing_agent",
    label: "Überzugsmittel",
    description: "Bildet schützende Oberflächen.",
    badgeClass: "bg-indigo-100 text-indigo-900 border-indigo-200",
  },
  {
    id: "modified_starch",
    label: "Modifizierte Stärke",
    description: "Chemisch oder physikalisch behandelte Stärke.",
    badgeClass: "bg-stone-100 text-stone-900 border-stone-200",
  },
  {
    id: "other",
    label: "Sonstige",
    description: "Weitere technologische Zusatzstoffe.",
    badgeClass: "bg-slate-100 text-slate-900 border-slate-200",
  },
];

/**
 * Curated registry. Covers the additives most frequently encountered in
 * German retail and hospital catering. Unknown codes still surface in the UI —
 * they just fall back to the "Sonstige" category without clinical flags.
 */
export const ADDITIVES: Additive[] = [
  // Farbstoffe — E100 series
  { code: "E100", name: "Curcumin", categoryId: "color", clinicalFlags: [] },
  { code: "E101", name: "Riboflavin (Lactoflavin)", categoryId: "color", clinicalFlags: [] },
  {
    code: "E102",
    name: "Tartrazin",
    categoryId: "color",
    clinicalFlags: ["azo_dye"],
    notes: "LMIV: Hinweispflicht „Kann Aktivität und Aufmerksamkeit bei Kindern beeinträchtigen“.",
  },
  {
    code: "E104",
    name: "Chinolingelb",
    categoryId: "color",
    clinicalFlags: ["azo_dye"],
    notes: "LMIV: Hinweispflicht „Kann Aktivität und Aufmerksamkeit bei Kindern beeinträchtigen“.",
  },
  {
    code: "E110",
    name: "Gelborange S",
    categoryId: "color",
    clinicalFlags: ["azo_dye"],
    notes: "LMIV: Hinweispflicht „Kann Aktivität und Aufmerksamkeit bei Kindern beeinträchtigen“.",
  },
  { code: "E120", name: "Echtes Karmin / Cochenille", categoryId: "color", clinicalFlags: [] },
  {
    code: "E122",
    name: "Azorubin",
    categoryId: "color",
    clinicalFlags: ["azo_dye"],
    notes: "LMIV: Hinweispflicht „Kann Aktivität und Aufmerksamkeit bei Kindern beeinträchtigen“.",
  },
  {
    code: "E124",
    name: "Cochenillerot A",
    categoryId: "color",
    clinicalFlags: ["azo_dye"],
    notes: "LMIV: Hinweispflicht „Kann Aktivität und Aufmerksamkeit bei Kindern beeinträchtigen“.",
  },
  {
    code: "E129",
    name: "Allurarot AC",
    categoryId: "color",
    clinicalFlags: ["azo_dye"],
    notes: "LMIV: Hinweispflicht „Kann Aktivität und Aufmerksamkeit bei Kindern beeinträchtigen“.",
  },
  { code: "E131", name: "Patentblau V", categoryId: "color", clinicalFlags: [] },
  { code: "E132", name: "Indigotin (Indigokarmin)", categoryId: "color", clinicalFlags: [] },
  { code: "E133", name: "Brillantblau FCF", categoryId: "color", clinicalFlags: [] },
  { code: "E140", name: "Chlorophyll", categoryId: "color", clinicalFlags: [] },
  { code: "E141", name: "Kupferkomplexe von Chlorophyllen", categoryId: "color", clinicalFlags: [] },
  { code: "E150a", name: "Zuckerkulör (einfach)", categoryId: "color", clinicalFlags: [] },
  { code: "E150c", name: "Zuckerkulör (Ammoniak)", categoryId: "color", clinicalFlags: [] },
  { code: "E150d", name: "Zuckerkulör (Ammonsulfit)", categoryId: "color", clinicalFlags: [] },
  { code: "E153", name: "Pflanzenkohle", categoryId: "color", clinicalFlags: [] },
  { code: "E160a", name: "Carotin", categoryId: "color", clinicalFlags: [] },
  { code: "E160b", name: "Annatto / Bixin / Norbixin", categoryId: "color", clinicalFlags: [] },
  { code: "E160c", name: "Paprika-Extrakt (Capsanthin)", categoryId: "color", clinicalFlags: [] },
  { code: "E161b", name: "Lutein", categoryId: "color", clinicalFlags: [] },
  { code: "E162", name: "Betanin (Beetenrot)", categoryId: "color", clinicalFlags: [] },
  { code: "E163", name: "Anthocyane", categoryId: "color", clinicalFlags: [] },
  { code: "E170", name: "Calciumcarbonat", categoryId: "color", clinicalFlags: [] },
  {
    code: "E171",
    name: "Titandioxid",
    categoryId: "color",
    clinicalFlags: [],
    notes: "EU-Verbot in Lebensmitteln seit 07.08.2022 (Übergangsfristen für Bestände).",
  },
  { code: "E172", name: "Eisenoxide und -hydroxide", categoryId: "color", clinicalFlags: [] },

  // Konservierungsstoffe — E200 series
  { code: "E200", name: "Sorbinsäure", categoryId: "preservative", clinicalFlags: [] },
  { code: "E202", name: "Kaliumsorbat", categoryId: "preservative", clinicalFlags: [] },
  { code: "E210", name: "Benzoesäure", categoryId: "preservative", clinicalFlags: [] },
  { code: "E211", name: "Natriumbenzoat", categoryId: "preservative", clinicalFlags: [] },
  { code: "E212", name: "Kaliumbenzoat", categoryId: "preservative", clinicalFlags: [] },
  { code: "E214", name: "Ethyl-p-hydroxybenzoat (PHB-Ester)", categoryId: "preservative", clinicalFlags: [] },
  {
    code: "E220",
    name: "Schwefeldioxid",
    categoryId: "preservative",
    clinicalFlags: ["sulfite"],
    notes: "Kennzeichnungspflichtiges Allergen ab 10 mg/kg bzw. 10 mg/l.",
  },
  {
    code: "E221",
    name: "Natriumsulfit",
    categoryId: "preservative",
    clinicalFlags: ["sulfite"],
    notes: "Kennzeichnungspflichtiges Allergen ab 10 mg/kg bzw. 10 mg/l.",
  },
  {
    code: "E223",
    name: "Natriumdisulfit (Metabisulfit)",
    categoryId: "preservative",
    clinicalFlags: ["sulfite"],
    notes: "Kennzeichnungspflichtiges Allergen ab 10 mg/kg bzw. 10 mg/l.",
  },
  {
    code: "E224",
    name: "Kaliumdisulfit",
    categoryId: "preservative",
    clinicalFlags: ["sulfite"],
    notes: "Kennzeichnungspflichtiges Allergen ab 10 mg/kg bzw. 10 mg/l.",
  },
  {
    code: "E228",
    name: "Kaliumhydrogensulfit",
    categoryId: "preservative",
    clinicalFlags: ["sulfite"],
    notes: "Kennzeichnungspflichtiges Allergen ab 10 mg/kg bzw. 10 mg/l.",
  },
  {
    code: "E249",
    name: "Kaliumnitrit",
    categoryId: "preservative",
    clinicalFlags: ["nitrite_nitrate"],
    notes: "Nur in zugelassenen Fleischerzeugnissen; bildungsfähig zu Nitrosaminen.",
  },
  {
    code: "E250",
    name: "Natriumnitrit",
    categoryId: "preservative",
    clinicalFlags: ["nitrite_nitrate"],
    notes: "Nur in zugelassenen Fleischerzeugnissen; bildungsfähig zu Nitrosaminen.",
  },
  {
    code: "E251",
    name: "Natriumnitrat",
    categoryId: "preservative",
    clinicalFlags: ["nitrite_nitrate"],
  },
  {
    code: "E252",
    name: "Kaliumnitrat",
    categoryId: "preservative",
    clinicalFlags: ["nitrite_nitrate"],
  },
  { code: "E260", name: "Essigsäure", categoryId: "preservative", clinicalFlags: [] },
  { code: "E270", name: "Milchsäure", categoryId: "preservative", clinicalFlags: [] },
  { code: "E280", name: "Propionsäure", categoryId: "preservative", clinicalFlags: [] },
  { code: "E282", name: "Calciumpropionat", categoryId: "preservative", clinicalFlags: [] },
  { code: "E290", name: "Kohlendioxid", categoryId: "preservative", clinicalFlags: [] },

  // Antioxidationsmittel — E300 series
  { code: "E300", name: "Ascorbinsäure (Vitamin C)", categoryId: "antioxidant", clinicalFlags: [] },
  { code: "E301", name: "Natriumascorbat", categoryId: "antioxidant", clinicalFlags: [] },
  { code: "E304", name: "Ascorbylpalmitat", categoryId: "antioxidant", clinicalFlags: [] },
  { code: "E306", name: "Tocopherol-haltige Extrakte (Vitamin E)", categoryId: "antioxidant", clinicalFlags: [] },
  { code: "E307", name: "Alpha-Tocopherol", categoryId: "antioxidant", clinicalFlags: [] },
  { code: "E320", name: "Butylhydroxyanisol (BHA)", categoryId: "antioxidant", clinicalFlags: [] },
  { code: "E321", name: "Butylhydroxytoluol (BHT)", categoryId: "antioxidant", clinicalFlags: [] },
  { code: "E322", name: "Lecithine", categoryId: "emulsifier", clinicalFlags: [] },

  // Säureregulatoren — E330–E343
  { code: "E330", name: "Citronensäure", categoryId: "acidity_regulator", clinicalFlags: [] },
  { code: "E331", name: "Natriumcitrate", categoryId: "acidity_regulator", clinicalFlags: [] },
  { code: "E332", name: "Kaliumcitrate", categoryId: "acidity_regulator", clinicalFlags: [] },
  { code: "E333", name: "Calciumcitrate", categoryId: "acidity_regulator", clinicalFlags: [] },
  { code: "E334", name: "L-Weinsäure", categoryId: "acidity_regulator", clinicalFlags: [] },
  { code: "E336", name: "Kaliumtartrate", categoryId: "acidity_regulator", clinicalFlags: [] },
  {
    code: "E338",
    name: "Phosphorsäure",
    categoryId: "acidity_regulator",
    clinicalFlags: ["phosphate"],
    notes: "Phosphatzusatz – bei Niereninsuffizienz strikt limitieren.",
  },
  {
    code: "E339",
    name: "Natriumphosphate",
    categoryId: "acidity_regulator",
    clinicalFlags: ["phosphate"],
    notes: "Phosphatzusatz – bei Niereninsuffizienz strikt limitieren.",
  },
  {
    code: "E340",
    name: "Kaliumphosphate",
    categoryId: "acidity_regulator",
    clinicalFlags: ["phosphate"],
    notes: "Phosphatzusatz – bei Niereninsuffizienz strikt limitieren.",
  },
  {
    code: "E341",
    name: "Calciumphosphate",
    categoryId: "acidity_regulator",
    clinicalFlags: ["phosphate"],
    notes: "Phosphatzusatz – bei Niereninsuffizienz strikt limitieren.",
  },
  {
    code: "E343",
    name: "Magnesiumphosphate",
    categoryId: "acidity_regulator",
    clinicalFlags: ["phosphate"],
    notes: "Phosphatzusatz – bei Niereninsuffizienz strikt limitieren.",
  },

  // Verdickungs-/Geliermittel — E400 series
  { code: "E400", name: "Alginsäure", categoryId: "thickener", clinicalFlags: [] },
  { code: "E401", name: "Natriumalginat", categoryId: "thickener", clinicalFlags: [] },
  { code: "E406", name: "Agar-Agar", categoryId: "thickener", clinicalFlags: [] },
  { code: "E407", name: "Carrageen", categoryId: "thickener", clinicalFlags: [] },
  { code: "E410", name: "Johannisbrotkernmehl", categoryId: "thickener", clinicalFlags: [] },
  { code: "E412", name: "Guarkernmehl", categoryId: "thickener", clinicalFlags: [] },
  { code: "E414", name: "Gummi arabicum", categoryId: "thickener", clinicalFlags: [] },
  { code: "E415", name: "Xanthan", categoryId: "thickener", clinicalFlags: [] },
  { code: "E418", name: "Gellan", categoryId: "thickener", clinicalFlags: [] },
  { code: "E440", name: "Pektin", categoryId: "thickener", clinicalFlags: [] },

  // Polyole (E4xx)
  {
    code: "E420",
    name: "Sorbit",
    categoryId: "sweetener_polyol",
    clinicalFlags: ["polyol"],
    notes: "LMIV: ab > 10 % Hinweispflicht „Kann bei übermäßigem Verzehr abführend wirken“.",
  },
  {
    code: "E421",
    name: "Mannit",
    categoryId: "sweetener_polyol",
    clinicalFlags: ["polyol"],
    notes: "LMIV: ab > 10 % Hinweispflicht „Kann bei übermäßigem Verzehr abführend wirken“.",
  },

  // Emulgatoren / Phosphate — E450ff
  {
    code: "E450",
    name: "Diphosphate",
    categoryId: "emulsifier",
    clinicalFlags: ["phosphate"],
    notes: "Phosphatzusatz – bei Niereninsuffizienz strikt limitieren.",
  },
  {
    code: "E451",
    name: "Triphosphate",
    categoryId: "emulsifier",
    clinicalFlags: ["phosphate"],
    notes: "Phosphatzusatz – bei Niereninsuffizienz strikt limitieren.",
  },
  {
    code: "E452",
    name: "Polyphosphate",
    categoryId: "emulsifier",
    clinicalFlags: ["phosphate"],
    notes: "Phosphatzusatz – bei Niereninsuffizienz strikt limitieren.",
  },
  { code: "E460", name: "Cellulose", categoryId: "thickener", clinicalFlags: [] },
  { code: "E461", name: "Methylcellulose", categoryId: "thickener", clinicalFlags: [] },
  { code: "E466", name: "Carboxymethylcellulose (CMC)", categoryId: "thickener", clinicalFlags: [] },
  { code: "E471", name: "Mono- und Diglyceride von Speisefettsäuren", categoryId: "emulsifier", clinicalFlags: [] },
  { code: "E472a", name: "Essigsäureester von Mono- und Diglyceriden", categoryId: "emulsifier", clinicalFlags: [] },
  { code: "E472b", name: "Milchsäureester von Mono- und Diglyceriden", categoryId: "emulsifier", clinicalFlags: [] },
  { code: "E472c", name: "Citronensäureester von Mono- und Diglyceriden", categoryId: "emulsifier", clinicalFlags: [] },
  { code: "E472e", name: "Mono- und Diacetylweinsäureester (DATEM)", categoryId: "emulsifier", clinicalFlags: [] },
  { code: "E481", name: "Natriumstearoyl-2-lactylat", categoryId: "emulsifier", clinicalFlags: [] },

  // Trennmittel / pH-Regulatoren — E500 series
  { code: "E500", name: "Natriumcarbonate", categoryId: "raising_agent", clinicalFlags: [] },
  { code: "E501", name: "Kaliumcarbonate", categoryId: "raising_agent", clinicalFlags: [] },
  { code: "E503", name: "Ammoniumcarbonate", categoryId: "raising_agent", clinicalFlags: [] },
  { code: "E509", name: "Calciumchlorid", categoryId: "stabilizer", clinicalFlags: [] },
  { code: "E524", name: "Natriumhydroxid", categoryId: "acidity_regulator", clinicalFlags: [] },
  {
    code: "E541",
    name: "Saures Natriumaluminiumphosphat",
    categoryId: "raising_agent",
    clinicalFlags: ["phosphate"],
    notes: "Phosphatzusatz – bei Niereninsuffizienz strikt limitieren.",
  },
  { code: "E551", name: "Siliciumdioxid", categoryId: "anti_caking", clinicalFlags: [] },
  { code: "E552", name: "Calciumsilicat", categoryId: "anti_caking", clinicalFlags: [] },
  { code: "E553b", name: "Talkum", categoryId: "anti_caking", clinicalFlags: [] },
  { code: "E575", name: "Glucono-Delta-Lacton", categoryId: "acidity_regulator", clinicalFlags: [] },

  // Geschmacksverstärker — E600 series
  {
    code: "E620",
    name: "Glutaminsäure",
    categoryId: "flavor_enhancer",
    clinicalFlags: ["glutamate"],
  },
  {
    code: "E621",
    name: "Mononatriumglutamat",
    categoryId: "flavor_enhancer",
    clinicalFlags: ["glutamate"],
  },
  {
    code: "E622",
    name: "Monokaliumglutamat",
    categoryId: "flavor_enhancer",
    clinicalFlags: ["glutamate"],
  },
  {
    code: "E625",
    name: "Magnesiumglutamat",
    categoryId: "flavor_enhancer",
    clinicalFlags: ["glutamate"],
  },
  { code: "E627", name: "Dinatriumguanylat", categoryId: "flavor_enhancer", clinicalFlags: [] },
  { code: "E631", name: "Dinatriuminosinat", categoryId: "flavor_enhancer", clinicalFlags: [] },
  { code: "E635", name: "Dinatrium-5'-ribonukleotid", categoryId: "flavor_enhancer", clinicalFlags: [] },

  // Süßstoffe — E950–E969
  { code: "E950", name: "Acesulfam K", categoryId: "sweetener", clinicalFlags: [] },
  {
    code: "E951",
    name: "Aspartam",
    categoryId: "sweetener",
    clinicalFlags: ["phenylalanine_pku"],
    notes: "LMIV: „Enthält eine Phenylalaninquelle“ – bei PKU kontraindiziert.",
  },
  { code: "E952", name: "Cyclamat", categoryId: "sweetener", clinicalFlags: [] },
  { code: "E954", name: "Saccharin", categoryId: "sweetener", clinicalFlags: [] },
  { code: "E955", name: "Sucralose", categoryId: "sweetener", clinicalFlags: [] },
  { code: "E957", name: "Thaumatin", categoryId: "sweetener", clinicalFlags: [] },
  { code: "E960", name: "Steviolglycoside", categoryId: "sweetener", clinicalFlags: [] },
  {
    code: "E962",
    name: "Salz aus Aspartam-Acesulfam",
    categoryId: "sweetener",
    clinicalFlags: ["phenylalanine_pku"],
    notes: "LMIV: „Enthält eine Phenylalaninquelle“ – bei PKU kontraindiziert.",
  },
  {
    code: "E953",
    name: "Isomalt",
    categoryId: "sweetener_polyol",
    clinicalFlags: ["polyol"],
    notes: "LMIV: ab > 10 % Hinweispflicht „Kann bei übermäßigem Verzehr abführend wirken“.",
  },
  {
    code: "E965",
    name: "Maltit",
    categoryId: "sweetener_polyol",
    clinicalFlags: ["polyol"],
    notes: "LMIV: ab > 10 % Hinweispflicht „Kann bei übermäßigem Verzehr abführend wirken“.",
  },
  {
    code: "E966",
    name: "Lactit",
    categoryId: "sweetener_polyol",
    clinicalFlags: ["polyol"],
    notes: "LMIV: ab > 10 % Hinweispflicht „Kann bei übermäßigem Verzehr abführend wirken“.",
  },
  {
    code: "E967",
    name: "Xylit",
    categoryId: "sweetener_polyol",
    clinicalFlags: ["polyol"],
    notes: "LMIV: ab > 10 % Hinweispflicht „Kann bei übermäßigem Verzehr abführend wirken“.",
  },
  {
    code: "E968",
    name: "Erythrit",
    categoryId: "sweetener_polyol",
    clinicalFlags: ["polyol"],
    notes: "Polyolähnlich – große Mengen können Verdauungsbeschwerden auslösen.",
  },

  // Modifizierte Stärken / Sonstiges
  { code: "E1400", name: "Dextrine, geröstet", categoryId: "modified_starch", clinicalFlags: [] },
  { code: "E1404", name: "Oxidierte Stärke", categoryId: "modified_starch", clinicalFlags: [] },
  { code: "E1410", name: "Monostärkephosphat", categoryId: "modified_starch", clinicalFlags: ["phosphate"] },
  { code: "E1412", name: "Distärkephosphat", categoryId: "modified_starch", clinicalFlags: ["phosphate"] },
  { code: "E1414", name: "Acetyliertes Distärkephosphat", categoryId: "modified_starch", clinicalFlags: ["phosphate"] },
  { code: "E1422", name: "Acetyliertes Distärkeadipat", categoryId: "modified_starch", clinicalFlags: [] },
  { code: "E1442", name: "Hydroxypropyldistärkephosphat", categoryId: "modified_starch", clinicalFlags: ["phosphate"] },
  { code: "E1450", name: "Stärkenatriumoctenylsuccinat", categoryId: "modified_starch", clinicalFlags: [] },
];

/**
 * Human-readable copy for each clinical flag. Keeping it co-located with the
 * catalog avoids a second source of truth when new flags are added.
 */
export const ADDITIVE_CLINICAL_FLAGS: Record<
  AdditiveClinicalFlag,
  { label: string; description: string; severity: "info" | "warning" }
> = {
  phosphate: {
    label: "Phosphatzusatz",
    description:
      "Zusatzphosphate werden zu ~90 % resorbiert. Bei Niereninsuffizienz strikt limitieren.",
    severity: "warning",
  },
  polyol: {
    label: "Zuckeralkohol",
    description:
      "Polyole können bei Aufnahme > 20 g/Tag abführend wirken. Bei Reizdarm-Patienten beachten.",
    severity: "info",
  },
  phenylalanine_pku: {
    label: "Phenylalanin-Quelle",
    description: "Aspartam enthält Phenylalanin – bei Phenylketonurie (PKU) kontraindiziert.",
    severity: "warning",
  },
  azo_dye: {
    label: "Azofarbstoff",
    description:
      "Mandatory LMIV-Warnung „Kann Aktivität und Aufmerksamkeit bei Kindern beeinträchtigen“.",
    severity: "warning",
  },
  sulfite: {
    label: "Sulfit",
    description:
      "Kennzeichnungspflichtiges Allergen ab 10 mg/kg. Risiko für Asthmatiker.",
    severity: "warning",
  },
  glutamate: {
    label: "Glutamat",
    description: "Glutamat-Geschmacksverstärker. Säuglingsnahrung ausgenommen.",
    severity: "info",
  },
  nitrite_nitrate: {
    label: "Nitrit/Nitrat",
    description:
      "Nur in Pökelerzeugnissen zugelassen. Nitrosamin-Bildung bei Hitze beachten.",
    severity: "warning",
  },
};
