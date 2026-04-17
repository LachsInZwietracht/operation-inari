import type { DailyMealPlan, Food, ReportExportRequest, Recipe } from "@/lib/types";
import {
  calculatePerServing,
  calculateRecipeNutrients,
  getNutrientValue,
  percentOfReference,
  scaleNutrients,
  sumNutrients,
} from "@/lib/nutrients";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { createRecipeLookup } from "@/lib/recipes";
import { resolveReferenceForPatient, getReferenceAmount } from "@/lib/reference-values";

const DEFAULT_NUTRIENT_IDS = [
  "energie",
  "eiweiss",
  "fett",
  "gesaettigte_fettsaeuren",
  "kohlenhydrate",
  "ballaststoffe",
  "zucker",
  "ungesaettigte_fettsaeuren",
];

const RECIPE_PORTION_WEIGHT_G = 350;

function getEntryNutrients(
  entry: DailyMealPlan["slots"][number]["entries"][number],
  foods: Map<string, Food>,
  recipes: Map<string, Recipe>,
  allFoods: Food[],
) {
  if (entry.type === "food") {
    const food = foods.get(entry.referenceId);
    if (!food) return [];
    return scaleNutrients(food.nutrients, food.baseAmount, entry.amount);
  }
  const recipe = recipes.get(entry.referenceId);
  if (!recipe) return [];
  const perServing = calculatePerServing(calculateRecipeNutrients(recipe, allFoods), recipe.servings);
  return scaleNutrients(perServing, 1, entry.amount);
}

export function buildDefaultReportExportRequest(
  plan: DailyMealPlan,
  recipes: Recipe[],
  foods: Food[],
): ReportExportRequest {
  const foodMap = new Map(foods.map((food) => [food.id, food]));
  const recipeMap = createRecipeLookup(recipes);
  const nutrientArrays = plan.slots.flatMap((slot) =>
    slot.entries.map((entry) => getEntryNutrients(entry, foodMap, recipeMap, foods)),
  );
  const planNutrients = sumNutrients(nutrientArrays.filter((values) => values.length > 0));
  const refConfig = resolveReferenceForPatient({
    standardId: "dge",
    dateOfBirth: "1990-01-01",
    gender: "m",
    lifeStage: "none",
  });

  const nutrientRows = DEFAULT_NUTRIENT_IDS.map((id) => {
    const def = NUTRIENT_DEFINITIONS.find((item) => item.id === id)!;
    const value = getNutrientValue(planNutrients, id);
    const reference = getReferenceAmount(refConfig, id);
    return {
      label: def.name,
      value: `${formatNumber(value, 1)} ${def.unit}`,
      reference: `${formatNumber(reference, 1)} ${def.unit}`,
      coverage: formatPercent(percentOfReference(value, reference)),
    };
  });

  const vitaminRows = NUTRIENT_DEFINITIONS.filter((item) => item.group === "vitamine")
    .slice(0, 6)
    .map((def) => {
      const value = getNutrientValue(planNutrients, def.id);
      const reference = getReferenceAmount(refConfig, def.id);
      return {
        label: def.name,
        value: `${formatNumber(value, 1)} ${def.unit}`,
        reference: `${formatNumber(reference, 1)} ${def.unit}`,
        coverage: formatPercent(percentOfReference(value, reference)),
      };
    });

  const mineralRows = NUTRIENT_DEFINITIONS.filter((item) => item.group === "mineralstoffe")
    .slice(0, 6)
    .map((def) => {
      const value = getNutrientValue(planNutrients, def.id);
      const reference = getReferenceAmount(refConfig, def.id);
      return {
        label: def.name,
        value: `${formatNumber(value, 1)} ${def.unit}`,
        reference: `${formatNumber(reference, 1)} ${def.unit}`,
        coverage: formatPercent(percentOfReference(value, reference)),
      };
    });

  const energyValue = getNutrientValue(planNutrients, "energie");
  const energyReference = getReferenceAmount(refConfig, "energie");
  const mealRows = plan.slots.map((slot) => ({
    slot: MEAL_SLOT_LABELS[slot.type],
    summary: slot.entries
      .map((entry) => {
        if (entry.type === "food") {
          return foodMap.get(entry.referenceId)?.name ?? "Unbekanntes Lebensmittel";
        }
        return recipeMap.get(entry.referenceId)?.name ?? "Unbekanntes Rezept";
      })
      .join(", "),
  }));

  const totalWeight = plan.slots.reduce(
    (sum, slot) =>
      sum +
      slot.entries.reduce(
        (slotSum, entry) => slotSum + (entry.type === "food" ? entry.amount : entry.amount * RECIPE_PORTION_WEIGHT_G),
        0,
      ),
    0,
  );
  const fiber = getNutrientValue(planNutrients, "ballaststoffe");

  return {
    format: "PDF",
    title: "Bericht aus API & Export",
    fileBaseName: `api-export-bericht-${plan.date}`,
    planDateLabel: formatDate(plan.date),
    reportLength: "full",
    selectedSections: {
      summary: true,
      table: true,
      charts: false,
      meals: true,
      notes: true,
    },
    activeSectionLabels: ["Kurzfazit & Indikatoren", "Nährstofftabellen", "Speiseplanübersicht", "Individuelle Hinweise"],
    summaryMetrics: [
      {
        label: "Energieabdeckung",
        value: `${formatNumber(energyValue, 0)} kcal`,
        reference: `${formatNumber(energyReference, 0)} kcal`,
        coverage: formatPercent(percentOfReference(energyValue, energyReference)),
      },
      {
        label: "Ballaststoffe",
        value: `${formatNumber(fiber, 1)} g`,
        reference: `${formatNumber(getReferenceAmount(refConfig, "ballaststoffe"), 1)} g`,
        coverage: formatPercent(percentOfReference(fiber, getReferenceAmount(refConfig, "ballaststoffe"))),
      },
      {
        label: "Plangewicht",
        value: `${formatNumber(totalWeight, 0)} g`,
      },
    ],
    nutrientRows,
    vitaminRows,
    mineralRows,
    mealRows,
    notes: "Automatisch aus dem zuletzt verfügbaren Ernährungsplan generiert.",
    narrative: `Der zuletzt verfügbare Ernährungsplan erreicht ${formatPercent(
      percentOfReference(energyValue, energyReference),
    )} des Energieziels.`,
    badges: [formatDate(plan.date), "API Export", "Standardprofil"],
    specialNotes: ["Export aus der zentralen API-&-Export-Oberfläche."],
  };
}
