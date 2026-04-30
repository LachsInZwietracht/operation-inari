import type { FoodSourceId } from "@/lib/types";

type ClinicalStatusTone = "neutral" | "trusted" | "review" | "risk" | "success";

export const CLINICAL_STATUS_TONES: Record<ClinicalStatusTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300",
  trusted: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  review: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  risk: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  success: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
};

export function getFoodSourceTrustTone(sourceId: FoodSourceId | undefined): ClinicalStatusTone {
  if (!sourceId) return "neutral";
  if (sourceId === "bls" || sourceId === "sfk") return "trusted";
  if (sourceId === "custom") return "review";
  if (sourceId === "off" || sourceId === "hersteller") return "review";
  return "neutral";
}

export function getClinicalStatusClass(tone: ClinicalStatusTone) {
  return CLINICAL_STATUS_TONES[tone];
}
