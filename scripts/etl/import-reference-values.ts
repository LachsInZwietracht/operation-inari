import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  REFERENCE_STANDARDS,
} from "@/lib/mock-data/reference-standards";
import { AGE_GROUPS } from "@/lib/reference-metadata";

interface ArgvOptions {
  standards: Set<string> | null;
}

interface ReferenceValueInsert {
  nutrient_id: string;
  amount: number;
  gender: "m" | "w";
  standard_id: "dge" | "oege" | "sge" | "rda";
  age_group_id: string;
  age_min: number | null;
  age_max: number | null;
  life_stage: string | null;
  source: string;
  label: string;
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_ROLE_KEY is required.\n" +
      "Run `npx supabase status` to copy the service role key for local dev."
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const AGE_GROUP_MAP = new Map(AGE_GROUPS.map((group) => [group.id, group]));

const LIFE_STAGE_LABELS: Record<string, string> = {
  pregnant_t1: "Schwangerschaft (1. Trimenon)",
  pregnant_t2: "Schwangerschaft (2. Trimenon)",
  pregnant_t3: "Schwangerschaft (3. Trimenon)",
  lactating: "Stillzeit",
};

function parseArgs(): ArgvOptions {
  const args = process.argv.slice(2);
  const standardsArg = args.find((arg) => arg.startsWith("--standard="));
  if (!standardsArg) {
    return { standards: null };
  }

  const ids = standardsArg
    .slice("--standard=".length)
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  if (ids.length === 0) {
    return { standards: null };
  }
  return { standards: new Set(ids) };
}

function toAgeValue(value: number | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

async function fetchNutrientNames(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("nutrient_definitions")
    .select("id,name");
  if (error) {
    throw new Error(`Failed to read nutrient definitions: ${error.message}`);
  }
  return new Map((data ?? []).map((row) => [row.id, row.name]));
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

async function deleteExistingSources(sources: Set<string>) {
  for (const source of sources) {
    const { error } = await supabase
      .from("reference_values")
      .delete()
      .eq("source", source);
    if (error) {
      throw new Error(`Failed to delete reference values for ${source}: ${error.message}`);
    }
  }
}

async function insertReferenceValues(rows: ReferenceValueInsert[]) {
  if (rows.length === 0) return;

  for (const batch of chunk(rows, 500)) {
    const { error } = await supabase
      .from("reference_values")
      .insert(batch);
    if (error) {
      throw new Error(`Failed to insert reference values: ${error.message}`);
    }
  }
}

async function main() {
  const options = parseArgs();
  const nutrientNames = await fetchNutrientNames();

  const standards = REFERENCE_STANDARDS.filter((standard) =>
    options.standards ? options.standards.has(standard.id) : true
  );

  if (standards.length === 0) {
    console.error("No matching reference standards found for the provided filter.");
    process.exit(1);
  }

  const inserts: ReferenceValueInsert[] = [];
  const sourcesToClear = new Set<string>();

  for (const standard of standards) {
    const sourceLabel = `${standard.shortName} ${standard.edition}`;
    sourcesToClear.add(sourceLabel);

    for (const bracket of standard.brackets) {
      const ageGroup = AGE_GROUP_MAP.get(bracket.ageGroupId);
      if (!ageGroup) {
        throw new Error(`Unknown age group: ${bracket.ageGroupId}`);
      }

      const ageMin = toAgeValue(ageGroup.minAge);
      const ageMax = toAgeValue(ageGroup.maxAge);
      const lifeStage = bracket.lifeStage === "none" ? null : bracket.lifeStage;
      const genderLabel = bracket.gender === "m" ? "männlich" : "weiblich";
      const stageLabel = lifeStage ? ` · ${LIFE_STAGE_LABELS[lifeStage] ?? lifeStage}` : "";
      const bracketLabel = `${ageGroup.label} · ${genderLabel}${stageLabel}`;

      for (const value of bracket.values) {
        const nutrientName = nutrientNames.get(value.nutrientId) ?? value.nutrientId;
        inserts.push({
          nutrient_id: value.nutrientId,
          amount: value.amount,
          gender: bracket.gender,
          standard_id: standard.id as "dge" | "oege" | "sge" | "rda",
          age_group_id: ageGroup.id,
          age_min: ageMin,
          age_max: ageMax,
          life_stage: lifeStage,
          source: sourceLabel,
          label: `${sourceLabel} · ${bracketLabel} · ${nutrientName}`,
        });
      }
    }
  }

  console.log(`Preparing to upsert ${inserts.length.toLocaleString()} reference values...`);
  await deleteExistingSources(sourcesToClear);
  await insertReferenceValues(inserts);

  const { writeDataSourceEvent } = await import("./etl-event");
  await writeDataSourceEvent({
    dataSourceId: "bls",
    eventType: "nutrient_mapping",
    title: "Referenzwerte synchronisiert",
    summary: `${inserts.length} Referenzwerte aus ${sourcesToClear.size} Quellenstandards importiert.`,
    recordCount: inserts.length,
    metadata: { sources: Array.from(sourcesToClear) },
  });

  console.log("Reference values successfully synced.");
}

main().catch((error) => {
  console.error("Fatal reference import error:", error);
  process.exit(1);
});
