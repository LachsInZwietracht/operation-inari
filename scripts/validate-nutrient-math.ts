import { loadBlsWorkbook, NUTRIENT_MAP, parseNutrientValue, FAMS_CODE, FAPU_CODE } from "./etl/bls-shared";
import { scaleNutrients, sumNutrients } from "../lib/nutrients";
import type { Food, NutrientValue } from "../lib/types";

/**
 * SCIENTIFIC VALIDATION SCRIPT
 * 
 * This script verifies that our nutrient calculation logic (scaling, summing)
 * produces results that match the official BLS 4.0 reference data.
 */

async function main() {
  console.log("🧪 Starting Scientific Nutrient Validation...");

  let workbookData;
  try {
    workbookData = loadBlsWorkbook();
  } catch (err) {
    console.error("❌ Failed to load BLS workbook. Ensure data/BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx exists.");
    process.exit(1);
  }

  const { rows, headers, codeToHeader } = workbookData;
  console.log(`✅ Loaded ${rows.length} reference rows from BLS 4.0.`);
  console.log(`🔍 Available headers (first 5): ${headers.slice(0, 5).join(", ")}`);

  // 1. Pick reference foods (using stable BLS codes)
  const codeKey = headers.find(h => h.includes("BLS Code")) || "BLS Code";
  console.log(`🔍 Using column "${codeKey}" for BLS codes.`);
  console.log(`🔍 First 3 codes in data: ${rows.slice(0, 3).map(r => `"${r[codeKey]}"`).join(", ")}`);

  console.log(`🔍 First 20 food names: ${rows.slice(0, 20).map(r => r["Lebensmittelbezeichnung"]).join(", ")}`);

  const apfelRaw = rows.find(r => String(r["Lebensmittelbezeichnung"]).includes("Apfel") && (String(r[codeKey]).startsWith("F") || String(r[codeKey]).startsWith("O"))); 
  const eiRaw = rows.find(r => String(r["Lebensmittelbezeichnung"]).includes("Ei") && String(r[codeKey]).startsWith("E"));
  const milchRaw = rows.find(r => String(r["Lebensmittelbezeichnung"]).includes("Milch") && String(r[codeKey]).startsWith("M"));

  if (!apfelRaw) {
    const apfelMatch = rows.find(r => String(r["Lebensmittelbezeichnung"]).includes("Apfel"));
    if (apfelMatch) console.log(`🔍 Found possible Apfel match: ${apfelMatch["Lebensmittelbezeichnung"]} (${apfelMatch[codeKey]})`);
  }
  if (!eiRaw) {
    const eiMatch = rows.find(r => String(r["Lebensmittelbezeichnung"]).includes("Ei"));
    if (eiMatch) console.log(`🔍 Found possible Ei match: ${eiMatch["Lebensmittelbezeichnung"]} (${eiMatch[codeKey]})`);
  }
  if (!milchRaw) {
    const milchMatch = rows.find(r => String(r["Lebensmittelbezeichnung"]).includes("Milch"));
    if (milchMatch) console.log(`🔍 Found possible Milch match: ${milchMatch["Lebensmittelbezeichnung"]} (${milchMatch[codeKey]})`);
  }

  if (apfelRaw) console.log(`🔍 Found Apfel: ${apfelRaw["Lebensmittelbezeichnung"]} (${apfelRaw[codeKey]})`);
  if (eiRaw) console.log(`🔍 Found Ei: ${eiRaw["Lebensmittelbezeichnung"]} (${eiRaw[codeKey]})`);
  if (milchRaw) console.log(`🔍 Found Milch: ${milchRaw["Lebensmittelbezeichnung"]} (${milchRaw[codeKey]})`);


  if (!apfelRaw || !eiRaw || !milchRaw) {
    console.error("❌ Could not find reference foods in BLS data.");
    process.exit(1);
  }

  const mapToFood = (row: any): Food => {
    const nutrients: NutrientValue[] = [];
    
    // Map standard nutrients
    for (const mapping of NUTRIENT_MAP) {
      const header = codeToHeader.get(mapping.blsCode);
      if (header) {
        let val = parseNutrientValue(row[header]);
        if (val !== null) {
          if (mapping.conversionFactor) val *= mapping.conversionFactor;
          nutrients.push({ nutrientId: mapping.nutrientId, amount: val });
        }
      }
    }

    // Map unsaturated fats (FAMS + FAPU)
    const famsHeader = codeToHeader.get(FAMS_CODE);
    const fapuHeader = codeToHeader.get(FAPU_CODE);
    const fams = parseNutrientValue(row[famsHeader || ""]) || 0;
    const fapu = parseNutrientValue(row[fapuHeader || ""]) || 0;
    if (fams > 0 || fapu > 0) {
      nutrients.push({ nutrientId: "ungesaettigte_fettsaeuren", amount: fams + fapu });
    }

    return {
      id: row["BLS Code"] || row["\uFEFFBLS Code"],
      name: row["Lebensmittelbezeichnung"] as string,
      categoryId: "cat_obst", // Dummy
      source: "bls",
      sourceId: "bls",
      nutrients,
      baseAmount: 100
    } as Food;
  };

  const apfel = mapToFood(apfelRaw);
  const ei = mapToFood(eiRaw);
  const milch = mapToFood(milchRaw);

  let errors = 0;
  let tests = 0;

  const assertClose = (actual: number, expected: number, label: string, tolerance = 0.001) => {
    tests++;
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
      console.error(`  ❌ FAIL: ${label}`);
      console.error(`     Actual:   ${actual}`);
      console.error(`     Expected: ${expected}`);
      console.error(`     Diff:     ${diff}`);
      errors++;
    } else {
      // console.log(`  ✅ PASS: ${label}`);
    }
  };

  // --- TEST 1: Scaling ---
  console.log("\n🧪 Test 1: Scaling (100g -> 250g)");
  const scaledApfel = scaleNutrients(apfel.nutrients, 100, 250);
  for (const n of apfel.nutrients) {
    const scaled = scaledApfel.find(s => s.nutrientId === n.nutrientId);
    if (scaled) {
      assertClose(scaled.amount, n.amount * 2.5, `Scale ${n.nutrientId}`);
    }
  }

  // --- TEST 2: Summing ---
  console.log("🧪 Test 2: Summing (100g Apfel + 100g Ei)");
  const sum = sumNutrients([apfel.nutrients, ei.nutrients]);
  for (const n of apfel.nutrients) {
    const eiNutrient = ei.nutrients.find(en => en.nutrientId === n.nutrientId);
    const expected = n.amount + (eiNutrient?.amount || 0);
    const actual = sum.find(s => s.nutrientId === n.nutrientId)?.amount || 0;
    assertClose(actual, expected, `Sum ${n.nutrientId}`);
  }

  // --- TEST 3: Complex Recipe (The "Freiburg" Case) ---
  console.log("🧪 Test 3: Complex Recipe (250g Apfel, 50g Ei, 200g Milch)");
  const ingredients = [
    scaleNutrients(apfel.nutrients, 100, 250),
    scaleNutrients(ei.nutrients, 100, 50),
    scaleNutrients(milch.nutrients, 100, 200)
  ];
  const recipeTotal = sumNutrients(ingredients);

  for (const mapping of NUTRIENT_MAP) {
    const nId = mapping.nutrientId;
    const aVal = apfel.nutrients.find(n => n.nutrientId === nId)?.amount || 0;
    const eVal = ei.nutrients.find(n => n.nutrientId === nId)?.amount || 0;
    const mVal = milch.nutrients.find(n => n.nutrientId === nId)?.amount || 0;
    
    const expected = (aVal * 2.5) + (eVal * 0.5) + (mVal * 2.0);
    const actual = recipeTotal.find(n => n.nutrientId === nId)?.amount || 0;
    
    assertClose(actual, expected, `Complex ${nId}`);
  }

  console.log("\n--- Validation Summary ---");
  if (errors === 0) {
    console.log(`✅ All ${tests} assertions passed! Mathematical integrity verified.`);
  } else {
    console.error(`❌ ${errors} / ${tests} assertions failed.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
