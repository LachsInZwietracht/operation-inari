/**
 * German Food Synonym Generator
 *
 * Generates German regional and colloquial synonyms for BLS foods.
 * Inserts into food_synonyms with locale='de-DE', source='system'.
 *
 * Usage: npm run etl:synonyms
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BATCH_SIZE = 2000;

/**
 * Curated German synonym map.
 * Keys are substrings matched against food names (case-insensitive).
 * Values are synonym alternatives to insert.
 */
const GERMAN_SYNONYM_MAP: Record<string, string[]> = {
  // Regional vegetable names
  Karotte: ["Möhre", "Mohrrübe", "Gelbe Rübe", "Rüebli"],
  Möhre: ["Karotte", "Mohrrübe", "Gelbe Rübe"],
  Tomate: ["Paradeiser"],
  Paradeiser: ["Tomate"],
  Kartoffel: ["Erdapfel", "Grundbirne"],
  Erdapfel: ["Kartoffel"],
  Aubergine: ["Melanzani", "Eierfrucht"],
  Melanzani: ["Aubergine"],
  Blumenkohl: ["Karfiol"],
  Karfiol: ["Blumenkohl"],
  Rosenkohl: ["Kohlsprossen", "Sprossenkohl"],
  Kohlsprossen: ["Rosenkohl"],
  Porree: ["Lauch"],
  Lauch: ["Porree"],
  Wirsing: ["Welschkraut", "Welschkohl"],
  Paprika: ["Peperoni"],
  Steckrübe: ["Kohlrübe", "Wruke", "Erdkohlrabi"],
  "Rote Bete": ["Rote Rübe", "Rande", "Rahne"],
  Kürbis: ["Plutzer"],
  Zucchini: ["Zucchetto"],
  Feldsalat: ["Rapunzel", "Nüsslisalat", "Vogerlsalat"],
  Bohne: ["Fisole"],
  Meerrettich: ["Kren"],
  Kren: ["Meerrettich"],
  Sellerie: ["Zeller"],

  // Regional fruit names
  Aprikose: ["Marille"],
  Marille: ["Aprikose"],
  Pflaume: ["Zwetschge", "Zwetschke"],
  Zwetschge: ["Pflaume", "Zwetschke"],
  Johannisbeere: ["Ribisel", "Träuble"],
  Brombeere: ["Kratzbeere"],
  Heidelbeere: ["Blaubeere", "Schwarzbeere"],
  Blaubeere: ["Heidelbeere"],
  Preiselbeere: ["Kronsbeere", "Grante"],
  Orange: ["Apfelsine"],
  Mandarine: ["Clementine"],

  // Dairy & eggs
  Quark: ["Topfen", "Schotten"],
  Topfen: ["Quark"],
  Sahne: ["Rahm", "Obers", "Schmand"],
  Rahm: ["Sahne", "Obers"],
  Obers: ["Sahne", "Rahm"],
  Joghurt: ["Jogurt"],
  Jogurt: ["Joghurt"],
  Schmand: ["Schmant", "Saure Sahne"],
  "Saure Sahne": ["Schmand", "Sauerrahm"],
  Buttermilch: ["Sauermilch"],
  Frischkäse: ["Gervais"],

  // Bread & baked goods
  Brötchen: ["Semmel", "Schrippe", "Wecken", "Rundstück"],
  Semmel: ["Brötchen", "Schrippe"],
  Schrippe: ["Brötchen", "Semmel"],
  Pfannkuchen: ["Palatschinken", "Eierkuchen"],
  Palatschinken: ["Pfannkuchen", "Eierkuchen"],
  Berliner: ["Krapfen", "Pfannkuchen"],
  Krapfen: ["Berliner"],
  Hörnchen: ["Croissant", "Kipferl"],
  Croissant: ["Hörnchen", "Kipferl"],

  // Meat & sausage
  Hackfleisch: ["Faschiertes", "Gehacktes", "Mett"],
  Faschiertes: ["Hackfleisch"],
  Frikadelle: ["Bulette", "Fleischpflanzerl", "Fleischküchle"],
  Bulette: ["Frikadelle", "Fleischpflanzerl"],
  Fleischpflanzerl: ["Frikadelle", "Bulette"],
  Bratwurst: ["Rostbratwurst"],
  Wiener: ["Frankfurter", "Bockwurst"],
  Frankfurter: ["Wiener", "Bockwurst"],
  Schinken: ["Hamme"],

  // Condiments & spreads
  Mayonnaise: ["Mayo", "Majonäse"],
  Mayo: ["Mayonnaise"],
  Marmelade: ["Konfitüre", "Gsälz"],
  Konfitüre: ["Marmelade"],
  Senf: ["Mostrich", "Mostert"],

  // Grains & legumes
  Mais: ["Kukuruz"],
  Grieß: ["Griess"],
  Haferflocken: ["Haferbrei", "Porridge"],

  // Beverages
  Apfelschorle: ["Apfelsaftschorle", "Apfelspritzer"],
  Mineralwasser: ["Sprudel", "Selters"],
  Limonade: ["Limo", "Kracherl"],
  Saft: ["Fruchtsaft"],

  // Miscellaneous
  Marzipan: ["Marzipanmasse"],
  Lebkuchen: ["Pfefferkuchen", "Honigkuchen"],
  Bonbon: ["Zuckerl", "Gutsle", "Bützje"],
  Brühe: ["Bouillon", "Suppe"],
  Mehl: ["Auszugsmehl"],
  Zucker: ["Kristallzucker"],
  Honig: ["Bienenhonig"],
  Essig: ["Weinessig"],
};

async function main() {
  console.log("=== German Food Synonym Generator ===\n");

  // 1. Fetch all BLS foods
  console.log("Fetching BLS foods...");
  const { data: foods, error } = await supabase
    .from("foods")
    .select("id, name")
    .eq("data_source_id", "bls");

  if (error) {
    throw new Error(`Failed to fetch BLS foods: ${error.message}`);
  }

  if (!foods || foods.length === 0) {
    console.log("No BLS foods found. Run etl:bls first.");
    process.exit(0);
  }

  console.log(`Found ${foods.length} BLS foods\n`);

  // 2. Match foods against synonym map
  const synonymRows: Array<{
    food_id: string;
    name: string;
    locale: string;
    source: string;
  }> = [];

  const lowerMap = new Map<string, string[]>();
  for (const [key, values] of Object.entries(GERMAN_SYNONYM_MAP)) {
    lowerMap.set(key.toLowerCase(), values);
  }

  for (const food of foods) {
    const foodNameLower = food.name.toLowerCase();

    for (const [key, synonyms] of lowerMap) {
      if (foodNameLower.includes(key)) {
        for (const synonym of synonyms) {
          synonymRows.push({
            food_id: food.id,
            name: synonym,
            locale: "de-DE",
            source: "system",
          });
        }
      }
    }
  }

  console.log(`Generated ${synonymRows.length} synonym rows\n`);

  if (synonymRows.length === 0) {
    console.log("No synonyms to insert.");
    return;
  }

  // 3. Batch upsert
  let inserted = 0;
  for (let i = 0; i < synonymRows.length; i += BATCH_SIZE) {
    const batch = synonymRows.slice(i, i + BATCH_SIZE);
    const { error: upsertError } = await supabase
      .from("food_synonyms")
      .upsert(batch, { onConflict: "food_id,name,locale,source" });

    if (upsertError) {
      console.error(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${upsertError.message}`
      );
      continue;
    }

    inserted += batch.length;
    process.stdout.write(
      `  Progress: ${inserted}/${synonymRows.length}\r`
    );
  }

  console.log(`\nInserted ${inserted} German synonyms`);
  console.log("=== Synonym generation complete ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
