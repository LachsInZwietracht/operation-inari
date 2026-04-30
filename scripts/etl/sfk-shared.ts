/**
 * SFK (Souci-Fachmann-Kraut) ETL — Shared Utilities
 *
 * Nutrient mapping, file loading, and food group mapping for SFK imports.
 * Follows the same patterns as bls-shared.ts.
 */

import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { parseNutrientValue } from "./bls-shared";

// Re-export for convenience
export { parseNutrientValue };

// ---------------------------------------------------------------------------
// SFK Nutrient Mapping
// ---------------------------------------------------------------------------

export interface SfkNutrientMapping {
  sfkColumn: string;
  nutrientId: string;
  /** Multiply SFK value by this factor to get our unit. Default: 1 */
  conversionFactor?: number;
}

/**
 * Maps SFK column headers to our canonical nutrient IDs.
 * Nutrients shared with BLS reuse the same IDs; SFK-exclusive nutrients
 * use new IDs defined in the SFK migration.
 */
export const SFK_NUTRIENT_MAP: SfkNutrientMapping[] = [
  // Energie
  { sfkColumn: "Energie_kcal", nutrientId: "energie" },
  { sfkColumn: "Energie_kJ", nutrientId: "energie_kj" },

  // Makronährstoffe
  { sfkColumn: "Wasser", nutrientId: "wasser" },
  { sfkColumn: "Eiweiss", nutrientId: "eiweiss" },
  { sfkColumn: "Fett", nutrientId: "fett" },
  { sfkColumn: "Kohlenhydrate", nutrientId: "kohlenhydrate" },
  { sfkColumn: "Ballaststoffe", nutrientId: "ballaststoffe" },
  { sfkColumn: "Alkohol", nutrientId: "alkohol" },
  { sfkColumn: "Zucker", nutrientId: "zucker" },
  { sfkColumn: "Gesaettigte_FS", nutrientId: "gesaettigte_fettsaeuren" },

  // Vitamine
  { sfkColumn: "Vitamin_A_RE", nutrientId: "vitamin_a" },
  { sfkColumn: "Beta_Carotin", nutrientId: "beta_carotin" },
  { sfkColumn: "Retinol", nutrientId: "retinol" },
  { sfkColumn: "Thiamin", nutrientId: "vitamin_b1" },
  { sfkColumn: "Riboflavin", nutrientId: "vitamin_b2" },
  { sfkColumn: "Pyridoxin", nutrientId: "vitamin_b6" },
  { sfkColumn: "Cobalamin", nutrientId: "vitamin_b12" },
  { sfkColumn: "Ascorbinsaeure", nutrientId: "vitamin_c" },
  { sfkColumn: "Calciferol", nutrientId: "vitamin_d" },
  { sfkColumn: "Tocopherol", nutrientId: "vitamin_e" },
  { sfkColumn: "Alpha_Tocopherol", nutrientId: "alpha_tocopherol" },
  { sfkColumn: "Folat", nutrientId: "folsaeure" },
  { sfkColumn: "Niacin", nutrientId: "niacin" },
  { sfkColumn: "Vitamin_K", nutrientId: "vitamin_k" },
  { sfkColumn: "Phyllochinon", nutrientId: "vitamin_k1" },
  { sfkColumn: "Menachinon", nutrientId: "vitamin_k2" },
  { sfkColumn: "Biotin", nutrientId: "biotin" },
  { sfkColumn: "Pantothensaeure", nutrientId: "pantothensaeure" },

  // Mineralstoffe
  { sfkColumn: "Calcium", nutrientId: "calcium" },
  { sfkColumn: "Eisen", nutrientId: "eisen" },
  { sfkColumn: "Magnesium", nutrientId: "magnesium" },
  { sfkColumn: "Kalium", nutrientId: "kalium" },
  { sfkColumn: "Natrium", nutrientId: "natrium" },
  { sfkColumn: "Zink", nutrientId: "zink" },
  { sfkColumn: "Phosphor", nutrientId: "phosphor" },
  { sfkColumn: "Jod", nutrientId: "jod" },
  { sfkColumn: "Kupfer", nutrientId: "kupfer" },
  { sfkColumn: "Mangan", nutrientId: "mangan" },
  { sfkColumn: "Fluorid", nutrientId: "fluorid" },
  { sfkColumn: "Chlorid", nutrientId: "chlorid" },
  { sfkColumn: "Selen", nutrientId: "selen" },
  { sfkColumn: "Chrom", nutrientId: "chrom" },
  { sfkColumn: "Molybdaen", nutrientId: "molybdaen" },
  { sfkColumn: "Silicium", nutrientId: "silicium" },

  // Aminosäuren (essential)
  { sfkColumn: "Isoleucin", nutrientId: "isoleucin" },
  { sfkColumn: "Leucin", nutrientId: "leucin" },
  { sfkColumn: "Lysin", nutrientId: "lysin" },
  { sfkColumn: "Methionin", nutrientId: "methionin" },
  { sfkColumn: "Cystein", nutrientId: "cystein" },
  { sfkColumn: "Phenylalanin", nutrientId: "phenylalanin" },
  { sfkColumn: "Tyrosin", nutrientId: "tyrosin" },
  { sfkColumn: "Threonin", nutrientId: "threonin" },
  { sfkColumn: "Tryptophan", nutrientId: "tryptophan" },
  { sfkColumn: "Valin", nutrientId: "valin" },

  // Aminosäuren (non-essential)
  { sfkColumn: "Arginin", nutrientId: "arginin" },
  { sfkColumn: "Histidin", nutrientId: "histidin" },
  { sfkColumn: "Alanin", nutrientId: "alanin" },
  { sfkColumn: "Asparaginsaeure", nutrientId: "asparaginsaeure" },
  { sfkColumn: "Glutaminsaeure", nutrientId: "glutaminsaeure" },
  { sfkColumn: "Glycin", nutrientId: "glycin" },
  { sfkColumn: "Prolin", nutrientId: "prolin" },
  { sfkColumn: "Serin", nutrientId: "serin" },

  // Fettsäuren (Detail)
  { sfkColumn: "Laurinsaeure", nutrientId: "laurinsaeure" },
  { sfkColumn: "Myristinsaeure", nutrientId: "myristinsaeure" },
  { sfkColumn: "Palmitinsaeure", nutrientId: "palmitinsaeure" },
  { sfkColumn: "Stearinsaeure", nutrientId: "stearinsaeure" },
  { sfkColumn: "Oelsaeure", nutrientId: "oelsaeure" },
  { sfkColumn: "Linolsaeure", nutrientId: "linolsaeure" },
  { sfkColumn: "Linolensaeure", nutrientId: "linolensaeure" },
  { sfkColumn: "Arachidonsaeure", nutrientId: "arachidonsaeure" },
  { sfkColumn: "EPA", nutrientId: "epa" },
  { sfkColumn: "DHA", nutrientId: "dha" },
  { sfkColumn: "Trans_Fettsaeuren", nutrientId: "trans_fettsaeuren" },
  { sfkColumn: "Omega3_gesamt", nutrientId: "omega_3_gesamt" },
  { sfkColumn: "Omega6_gesamt", nutrientId: "omega_6_gesamt" },

  // Sonstige
  { sfkColumn: "Cholesterin", nutrientId: "cholesterin" },
  { sfkColumn: "Purine", nutrientId: "purine" },
  { sfkColumn: "Harnsaeure", nutrientId: "harnsaeure" },
  { sfkColumn: "Oxalsaeure", nutrientId: "oxalsaeure" },
  { sfkColumn: "Staerke", nutrientId: "staerke" },
  { sfkColumn: "Sorbit", nutrientId: "sorbit" },
  { sfkColumn: "Organische_Saeuren", nutrientId: "organische_saeuren" },
];

/**
 * Expected columns in the SFK data file.
 * This documents the expected file structure for when the real data file is acquired.
 */
export const SFK_EXPECTED_COLUMNS = [
  "SFK_Code",
  "Lebensmittelbezeichnung",
  "Gruppe",
  ...SFK_NUTRIENT_MAP.map((m) => m.sfkColumn),
] as const;

// ---------------------------------------------------------------------------
// SFK Food Group Mapping
// ---------------------------------------------------------------------------

/**
 * Maps SFK food group names to our internal food_group_id and category_id.
 * SFK uses German-language group names as a classification column.
 */
export const SFK_FOOD_GROUP_MAP: Record<
  string,
  { foodGroupId: string; categoryId: string }
> = {
  "Getreide": { foodGroupId: "fg_C", categoryId: "cat_getreide" },
  "Brot": { foodGroupId: "fg_B", categoryId: "cat_getreide" },
  "Gemuese": { foodGroupId: "fg_G", categoryId: "cat_gemuese" },
  "Gemüse": { foodGroupId: "fg_G", categoryId: "cat_gemuese" },
  "Obst": { foodGroupId: "fg_O", categoryId: "cat_obst" },
  "Milch": { foodGroupId: "fg_M", categoryId: "cat_milch" },
  "Milchprodukte": { foodGroupId: "fg_M", categoryId: "cat_milch" },
  "Eier": { foodGroupId: "fg_E", categoryId: "cat_eier" },
  "Fleisch": { foodGroupId: "fg_R", categoryId: "cat_fleisch" },
  "Fisch": { foodGroupId: "fg_T", categoryId: "cat_fisch" },
  "Fette": { foodGroupId: "fg_F", categoryId: "cat_oele" },
  "Öle": { foodGroupId: "fg_F", categoryId: "cat_oele" },
  "Oele": { foodGroupId: "fg_F", categoryId: "cat_oele" },
  "Nüsse": { foodGroupId: "fg_N", categoryId: "cat_nuesse" },
  "Nuesse": { foodGroupId: "fg_N", categoryId: "cat_nuesse" },
  "Hülsenfrüchte": { foodGroupId: "fg_G6", categoryId: "cat_huelsenfruechte" },
  "Huelsenfruechte": { foodGroupId: "fg_G6", categoryId: "cat_huelsenfruechte" },
  "Gewürze": { foodGroupId: "fg_W", categoryId: "cat_gewuerze" },
  "Gewuerze": { foodGroupId: "fg_W", categoryId: "cat_gewuerze" },
  "Getränke": { foodGroupId: "fg_H", categoryId: "cat_getraenke" },
  "Getraenke": { foodGroupId: "fg_H", categoryId: "cat_getraenke" },
  "Süßwaren": { foodGroupId: "fg_S", categoryId: "cat_snacks" },
  "Suesswaren": { foodGroupId: "fg_S", categoryId: "cat_snacks" },
  "Kartoffeln": { foodGroupId: "fg_K", categoryId: "cat_gemuese" },
};

const DEFAULT_FOOD_GROUP = { foodGroupId: "fg_C", categoryId: "cat_unbekannt" };

export function deriveSfkFoodGroup(groupName: string): {
  foodGroupId: string;
  categoryId: string;
} {
  const trimmed = groupName.trim();
  return SFK_FOOD_GROUP_MAP[trimmed] ?? DEFAULT_FOOD_GROUP;
}

// ---------------------------------------------------------------------------
// SFK File Loader
// ---------------------------------------------------------------------------

export interface SfkWorkbookData {
  rows: Record<string, unknown>[];
  headers: string[];
  columnToHeader: Map<string, string>;
}

/**
 * Loads an SFK data file (.xlsx or .csv) and returns parsed rows.
 * Supports both formats; auto-detects based on file extension.
 */
export function loadSfkWorkbook(filePath: string): SfkWorkbookData {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `SFK file not found at ${resolved}.\n` +
        "Provide the path via --file=<path>. The SFK database requires a commercial license."
    );
  }

  const ext = path.extname(resolved).toLowerCase();
  let workbook: XLSX.WorkBook;

  if (ext === ".csv") {
    const csvContent = fs.readFileSync(resolved, "utf-8");
    workbook = XLSX.read(csvContent, { type: "string" });
  } else {
    workbook = XLSX.readFile(resolved);
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: true,
  });

  if (rows.length === 0) {
    throw new Error("No data rows found in SFK workbook");
  }

  const headers = Object.keys(rows[0]);
  const columnToHeader = new Map<string, string>();
  for (const header of headers) {
    // SFK uses direct column names (no "CODE description" pattern like BLS)
    columnToHeader.set(header, header);
  }

  return { rows, headers, columnToHeader };
}

// ---------------------------------------------------------------------------
// Sample Data Generator
// ---------------------------------------------------------------------------

/**
 * Generates a sample SFK .xlsx file with representative foods for testing.
 * Call with: npx tsx -e "import { generateSfkSample } from './scripts/etl/sfk-shared'; generateSfkSample()"
 */
export function generateSfkSample(outDir?: string): string {
  const dir = outDir ?? path.resolve(__dirname, "../../data/SFK");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sampleFoods = [
    { SFK_Code: "SFK001", Lebensmittelbezeichnung: "Vollmilch (3,5% Fett)", Gruppe: "Milch" },
    { SFK_Code: "SFK002", Lebensmittelbezeichnung: "Hühnerei (gesamt)", Gruppe: "Eier" },
    { SFK_Code: "SFK003", Lebensmittelbezeichnung: "Weizenvollkornmehl", Gruppe: "Getreide" },
    { SFK_Code: "SFK004", Lebensmittelbezeichnung: "Rindfleisch (Filet, roh)", Gruppe: "Fleisch" },
    { SFK_Code: "SFK005", Lebensmittelbezeichnung: "Lachs (Atlantik, roh)", Gruppe: "Fisch" },
    { SFK_Code: "SFK006", Lebensmittelbezeichnung: "Karotte (roh)", Gruppe: "Gemuese" },
    { SFK_Code: "SFK007", Lebensmittelbezeichnung: "Apfel (mit Schale)", Gruppe: "Obst" },
    { SFK_Code: "SFK008", Lebensmittelbezeichnung: "Walnuss", Gruppe: "Nuesse" },
    { SFK_Code: "SFK009", Lebensmittelbezeichnung: "Olivenöl (nativ extra)", Gruppe: "Oele" },
    { SFK_Code: "SFK010", Lebensmittelbezeichnung: "Sojabohne (getrocknet)", Gruppe: "Huelsenfruechte" },
    { SFK_Code: "SFK011", Lebensmittelbezeichnung: "Kartoffel (festkochend, roh)", Gruppe: "Kartoffeln" },
    { SFK_Code: "SFK012", Lebensmittelbezeichnung: "Roggenvollkornbrot", Gruppe: "Brot" },
  ];

  // Build full rows with nutrient data
  const rows = sampleFoods.map((food, idx) => {
    const base: Record<string, unknown> = { ...food };

    // Add representative nutrient values (vary by food type)
    const multiplier = 0.5 + idx * 0.15;

    // Makro
    base.Energie_kcal = Math.round(80 + idx * 30);
    base.Energie_kJ = Math.round(base.Energie_kcal as number * 4.184);
    base.Wasser = +(75 - idx * 3).toFixed(1);
    base.Eiweiss = +(3.5 * multiplier).toFixed(2);
    base.Fett = +(2.0 * multiplier).toFixed(2);
    base.Kohlenhydrate = +(5.0 * multiplier).toFixed(2);
    base.Ballaststoffe = +(1.5 * multiplier).toFixed(2);
    base.Zucker = +(2.0 * multiplier).toFixed(2);
    base.Gesaettigte_FS = +(0.8 * multiplier).toFixed(2);
    base.Alkohol = 0;

    // Vitamine
    base.Vitamin_A_RE = Math.round(50 * multiplier);
    base.Beta_Carotin = Math.round(120 * multiplier);
    base.Retinol = Math.round(30 * multiplier);
    base.Thiamin = +(0.1 * multiplier).toFixed(3);
    base.Riboflavin = +(0.15 * multiplier).toFixed(3);
    base.Pyridoxin = +(0.2 * multiplier).toFixed(3);
    base.Cobalamin = +(0.5 * multiplier).toFixed(2);
    base.Ascorbinsaeure = +(8 * multiplier).toFixed(1);
    base.Calciferol = +(1.2 * multiplier).toFixed(2);
    base.Tocopherol = +(1.0 * multiplier).toFixed(2);
    base.Alpha_Tocopherol = +(0.9 * multiplier).toFixed(2);
    base.Folat = Math.round(30 * multiplier);
    base.Niacin = +(1.5 * multiplier).toFixed(2);
    base.Vitamin_K = +(5 * multiplier).toFixed(1);
    base.Phyllochinon = +(4 * multiplier).toFixed(1);
    base.Menachinon = +(1 * multiplier).toFixed(1);
    base.Biotin = +(3 * multiplier).toFixed(1);
    base.Pantothensaeure = +(0.4 * multiplier).toFixed(2);

    // Mineralstoffe
    base.Calcium = Math.round(120 * multiplier);
    base.Eisen = +(1.2 * multiplier).toFixed(2);
    base.Magnesium = Math.round(25 * multiplier);
    base.Kalium = Math.round(180 * multiplier);
    base.Natrium = Math.round(40 * multiplier);
    base.Zink = +(0.8 * multiplier).toFixed(2);
    base.Phosphor = Math.round(90 * multiplier);
    base.Jod = Math.round(10 * multiplier);
    base.Kupfer = Math.round(80 * multiplier);
    base.Mangan = Math.round(200 * multiplier);
    base.Fluorid = Math.round(15 * multiplier);
    base.Chlorid = Math.round(60 * multiplier);
    base.Selen = +(3 * multiplier).toFixed(1);
    base.Chrom = +(1 * multiplier).toFixed(1);
    base.Molybdaen = +(5 * multiplier).toFixed(1);
    base.Silicium = +(2 * multiplier).toFixed(1);

    // Aminosäuren
    base.Isoleucin = Math.round(200 * multiplier);
    base.Leucin = Math.round(320 * multiplier);
    base.Lysin = Math.round(280 * multiplier);
    base.Methionin = Math.round(90 * multiplier);
    base.Cystein = Math.round(50 * multiplier);
    base.Phenylalanin = Math.round(180 * multiplier);
    base.Tyrosin = Math.round(150 * multiplier);
    base.Threonin = Math.round(160 * multiplier);
    base.Tryptophan = Math.round(50 * multiplier);
    base.Valin = Math.round(240 * multiplier);
    base.Arginin = Math.round(200 * multiplier);
    base.Histidin = Math.round(100 * multiplier);
    base.Alanin = Math.round(180 * multiplier);
    base.Asparaginsaeure = Math.round(300 * multiplier);
    base.Glutaminsaeure = Math.round(600 * multiplier);
    base.Glycin = Math.round(140 * multiplier);
    base.Prolin = Math.round(200 * multiplier);
    base.Serin = Math.round(180 * multiplier);

    // Fettsäuren
    base.Laurinsaeure = Math.round(30 * multiplier);
    base.Myristinsaeure = Math.round(50 * multiplier);
    base.Palmitinsaeure = Math.round(200 * multiplier);
    base.Stearinsaeure = Math.round(80 * multiplier);
    base.Oelsaeure = Math.round(300 * multiplier);
    base.Linolsaeure = Math.round(150 * multiplier);
    base.Linolensaeure = Math.round(40 * multiplier);
    base.Arachidonsaeure = Math.round(10 * multiplier);
    base.EPA = Math.round(idx === 4 ? 400 : 5 * multiplier); // high for salmon
    base.DHA = Math.round(idx === 4 ? 600 : 5 * multiplier); // high for salmon
    base.Trans_Fettsaeuren = Math.round(5 * multiplier);
    base.Omega3_gesamt = Math.round(idx === 4 ? 1200 : 60 * multiplier);
    base.Omega6_gesamt = Math.round(180 * multiplier);

    // Sonstige
    base.Cholesterin = Math.round(idx === 1 ? 372 : 20 * multiplier); // high for egg
    base.Purine = Math.round(30 * multiplier);
    base.Harnsaeure = Math.round(70 * multiplier);
    base.Oxalsaeure = Math.round(idx === 5 ? 5 : 2 * multiplier); // spinach-adjacent
    base.Staerke = +(3 * multiplier).toFixed(1);
    base.Sorbit = Math.round(idx === 6 ? 400 : 10 * multiplier); // apple has sorbit
    base.Organische_Saeuren = +(0.3 * multiplier).toFixed(2);

    return base;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "SFK_Daten");

  const filePath = path.join(dir, "SFK_sample.xlsx");
  XLSX.writeFile(workbook, filePath);
  console.log(`Sample SFK file written to: ${filePath}`);
  return filePath;
}
