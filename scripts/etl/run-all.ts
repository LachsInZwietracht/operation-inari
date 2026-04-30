/**
 * Master ETL Orchestrator
 *
 * Runs the full ETL pipeline in the correct order.
 * Supports --skip, --only, and --dry-run flags.
 *
 * Usage:
 *   npm run etl:all
 *   npm run etl:all -- --dry-run
 *   npm run etl:all -- --skip=bls,off
 *   npm run etl:all -- --only=synonyms,portions
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

interface PipelineStep {
  id: string;
  label: string;
  command: string;
  optional?: boolean;
}

const STEPS: PipelineStep[] = [
  { id: "bls", label: "Import BLS 4.0 foods + nutrients", command: "npm run etl:bls" },
  { id: "verify", label: "Verify BLS import", command: "npm run etl:verify:bls" },
  { id: "sfk", label: "Import SFK foods + nutrients", command: "npm run etl:sfk", optional: true },
  { id: "verify-sfk", label: "Verify SFK import", command: "npm run etl:verify:sfk", optional: true },
  { id: "synonyms", label: "Generate German synonyms", command: "npm run etl:synonyms" },
  { id: "portions", label: "Import portion sizes", command: "npm run etl:portions" },
  { id: "reference-values", label: "Import DGE/ÖGE/SGE reference values", command: "npm run etl:reference-values" },
  { id: "recipes", label: "Seed recipes + meal plans", command: "npm run etl:recipes" },
  { id: "off", label: "Import Open Food Facts products", command: "npm run etl:off", optional: true },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const skip = new Set<string>();
  const only = new Set<string>();
  let dryRun = false;

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--skip=")) {
      for (const id of arg.slice(7).split(",")) {
        skip.add(id.trim());
      }
    } else if (arg.startsWith("--only=")) {
      for (const id of arg.slice(7).split(",")) {
        only.add(id.trim());
      }
    }
  }

  return { skip, only, dryRun };
}

function resolveSteps(
  skip: Set<string>,
  only: Set<string>
): PipelineStep[] {
  if (only.size > 0) {
    return STEPS.filter((s) => only.has(s.id));
  }
  return STEPS.filter((s) => !skip.has(s.id));
}

async function checkPrerequisites() {
  const errors: string[] = [];

  // Check service role key
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  // Check Supabase reachability
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "http://127.0.0.1:54321";
  try {
    const supabase = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy"
    );
    const { error } = await supabase
      .from("data_sources")
      .select("id")
      .limit(1);
    if (error) {
      errors.push(`Supabase not reachable: ${error.message}`);
    }
  } catch (err) {
    errors.push(
      `Supabase connection failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Check BLS Excel file
  const blsPath = "data/BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx";
  if (!existsSync(blsPath)) {
    errors.push(`BLS Excel file not found at ${blsPath}`);
  }

  return errors;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

async function main() {
  const { skip, only, dryRun } = parseArgs();
  const steps = resolveSteps(skip, only);

  console.log("╔════════════════════════════════════════╗");
  console.log("║     ETL Pipeline — Master Orchestrator ║");
  console.log("╚════════════════════════════════════════╝\n");

  // Show plan
  console.log(`Steps to run (${steps.length}/${STEPS.length}):`);
  for (const step of steps) {
    const tag = step.optional ? " (optional)" : "";
    console.log(`  ${step.id.padEnd(18)} ${step.label}${tag}`);
  }
  console.log();

  if (dryRun) {
    console.log("[DRY RUN] No steps will be executed.");
    console.log("\nCommands that would run:");
    for (const step of steps) {
      console.log(`  $ ${step.command}`);
    }
    return;
  }

  // Prerequisites check
  console.log("Checking prerequisites...");
  const errors = await checkPrerequisites();
  if (errors.length > 0) {
    console.error("\nPrerequisite check failed:");
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
  console.log("All prerequisites passed.\n");

  // Run steps
  const totalStart = Date.now();
  const results: Array<{
    id: string;
    status: "success" | "failed" | "skipped";
    duration: number;
  }> = [];

  for (const step of steps) {
    const stepStart = Date.now();
    console.log(`\n${"─".repeat(50)}`);
    console.log(`▶ [${step.id}] ${step.label}`);
    console.log(`  $ ${step.command}`);
    console.log(`${"─".repeat(50)}\n`);

    try {
      execSync(step.command, {
        stdio: "inherit",
        env: process.env,
        timeout: 10 * 60 * 1000, // 10 minutes per step
      });
      const duration = Date.now() - stepStart;
      results.push({ id: step.id, status: "success", duration });
      console.log(
        `\n✓ [${step.id}] completed in ${formatDuration(duration)}`
      );
    } catch (err) {
      const duration = Date.now() - stepStart;
      if (step.optional) {
        results.push({ id: step.id, status: "skipped", duration });
        console.warn(
          `\n⚠ [${step.id}] failed (optional, continuing): ${err instanceof Error ? err.message : String(err)}`
        );
      } else {
        results.push({ id: step.id, status: "failed", duration });
        console.error(
          `\n✗ [${step.id}] failed after ${formatDuration(duration)}`
        );
        console.error(
          err instanceof Error ? err.message : String(err)
        );
        break;
      }
    }
  }

  // Summary
  const totalDuration = Date.now() - totalStart;
  console.log(`\n${"═".repeat(50)}`);
  console.log("Pipeline Summary");
  console.log(`${"═".repeat(50)}`);

  for (const r of results) {
    const icon =
      r.status === "success" ? "✓" : r.status === "skipped" ? "⚠" : "✗";
    console.log(
      `  ${icon} ${r.id.padEnd(18)} ${r.status.padEnd(8)} ${formatDuration(r.duration)}`
    );
  }

  const failed = results.filter((r) => r.status === "failed");
  console.log(`\nTotal time: ${formatDuration(totalDuration)}`);

  if (failed.length > 0) {
    console.error(`\n${failed.length} step(s) failed.`);
    process.exit(1);
  }

  console.log("\nAll steps completed successfully.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
