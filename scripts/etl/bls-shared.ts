import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

export const BLS_FILE = path.resolve(
  __dirname,
  "../../data/BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx"
);

export interface NutrientMapping {
  blsCode: string;
  nutrientId: string;
  /** Multiply BLS value by this factor to get our unit. Default: 1 */
  conversionFactor?: number;
}

export const NUTRIENT_MAP: NutrientMapping[] = [
  // Energie
  { blsCode: "ENERCC", nutrientId: "energie" },
  { blsCode: "ENERCJ", nutrientId: "energie_kj" },

  // Makronährstoffe
  { blsCode: "WATER", nutrientId: "wasser" },
  { blsCode: "PROT625", nutrientId: "eiweiss" },
  { blsCode: "FAT", nutrientId: "fett" },
  { blsCode: "CHO", nutrientId: "kohlenhydrate" },
  { blsCode: "FIBT", nutrientId: "ballaststoffe" },
  { blsCode: "ALC", nutrientId: "alkohol" },
  { blsCode: "SUGAR", nutrientId: "zucker" },
  { blsCode: "FASAT", nutrientId: "gesaettigte_fettsaeuren" },
  // FAMS + FAPU → ungesaettigte_fettsaeuren (handled separately)

  // Vitamine
  { blsCode: "VITA", nutrientId: "vitamin_a" },
  { blsCode: "THIA", nutrientId: "vitamin_b1" },
  { blsCode: "RIBF", nutrientId: "vitamin_b2" },
  { blsCode: "VITB6", nutrientId: "vitamin_b6", conversionFactor: 0.001 },
  { blsCode: "VITB12", nutrientId: "vitamin_b12" },
  { blsCode: "VITC", nutrientId: "vitamin_c" },
  { blsCode: "VITD", nutrientId: "vitamin_d" },
  { blsCode: "VITE", nutrientId: "vitamin_e" },
  { blsCode: "FOL", nutrientId: "folsaeure" },
  { blsCode: "NIAEQ", nutrientId: "niacin" },
  { blsCode: "VITK", nutrientId: "vitamin_k" },
  { blsCode: "BIOT", nutrientId: "biotin" },
  { blsCode: "PANTAC", nutrientId: "pantothensaeure" },

  // Mineralstoffe
  { blsCode: "NACL", nutrientId: "salz" },
  { blsCode: "NA", nutrientId: "natrium" },
  { blsCode: "CLD", nutrientId: "chlorid" },
  { blsCode: "K", nutrientId: "kalium" },
  { blsCode: "CA", nutrientId: "calcium" },
  { blsCode: "MG", nutrientId: "magnesium" },
  { blsCode: "P", nutrientId: "phosphor" },
  { blsCode: "FE", nutrientId: "eisen" },
  { blsCode: "ZN", nutrientId: "zink" },
  { blsCode: "ID", nutrientId: "jod" },
  { blsCode: "CU", nutrientId: "kupfer" },
  { blsCode: "MN", nutrientId: "mangan" },
  { blsCode: "FD", nutrientId: "fluorid" },
  { blsCode: "CHORL", nutrientId: "cholesterin" },
];

export const FAMS_CODE = "FAMS";
export const FAPU_CODE = "FAPU";

export function parseNutrientValue(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;

  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  const str = String(raw).trim();
  if (
    str === "-" ||
    str === "TR" ||
    str.startsWith("<LOD") ||
    str.startsWith("<LOQ")
  ) {
    return null;
  }

  const normalized = str.replace(",", ".");
  const num = parseFloat(normalized);
  if (Number.isNaN(num) || !Number.isFinite(num)) return null;
  return num;
}

export interface BlsWorkbookData {
  rows: Record<string, unknown>[];
  headers: string[];
  codeToHeader: Map<string, string>;
}

export function loadBlsWorkbook(): BlsWorkbookData {
  if (!fs.existsSync(BLS_FILE)) {
    throw new Error(
      `File not found at ${BLS_FILE}. Download the BLS 4.0 Excel from https://www.blsdb.de/ and place it there.`
    );
  }

  const workbook = XLSX.readFile(BLS_FILE);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: true,
  });

  if (rows.length === 0) {
    throw new Error("No data rows found in BLS workbook");
  }

  const headers = Object.keys(rows[0]);
  const codeToHeader = new Map<string, string>();
  for (const header of headers) {
    const spaceIdx = header.indexOf(" ");
    if (spaceIdx > 0) {
      const code = header.substring(0, spaceIdx);
      if (!header.includes("Datenherkunft") && !header.includes("Referenz")) {
        codeToHeader.set(code, header);
      }
    }
  }

  return { rows, headers, codeToHeader };
}
