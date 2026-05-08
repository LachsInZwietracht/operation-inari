import type { DailyMealPlan, Food, ReportExportRequest, Recipe, ResolvedReferenceConfig } from "@/lib/types";
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
import { getReferenceAmount, resolveReferenceForPatient } from "@/lib/reference-values";

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

export type MealPlanReportVariant = "clinical" | "patient" | "lehrkueche";

export interface MealPlanReportContext {
  variant?: MealPlanReportVariant;
  patientId?: string;
  patientName?: string;
  patientIndication?: string;
  planId?: string;
  dietLineName?: string;
  notes?: string;
}

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

function describeEntry(
  entry: DailyMealPlan["slots"][number]["entries"][number],
  foods: Map<string, Food>,
  recipes: Map<string, Recipe>,
  variant: MealPlanReportVariant,
): string {
  if (entry.type === "food") {
    const food = foods.get(entry.referenceId);
    const name = food?.name ?? "Unbekanntes Lebensmittel";
    if (variant === "patient") {
      return `${name} (${formatNumber(entry.amount, 0)} g)`;
    }
    return `${name} · ${formatNumber(entry.amount, 0)} g`;
  }
  const recipe = recipes.get(entry.referenceId);
  const name = recipe?.name ?? "Unbekanntes Rezept";
  const portionLabel = entry.amount === 1 ? "Portion" : "Portionen";
  return `${name} · ${formatNumber(entry.amount, 0)} ${portionLabel}`;
}

function buildVariantConfig(variant: MealPlanReportVariant, ctx: MealPlanReportContext) {
  const patientLabel = ctx.patientName ? ` – ${ctx.patientName}` : "";
  switch (variant) {
    case "patient":
      return {
        title: `Ernährungsplan${patientLabel}`,
        fileBaseNamePrefix: "ernaehrungsplan-handout",
        reportLength: "short" as const,
        selectedSections: { summary: true, table: false, charts: false, meals: true, notes: true },
        sectionLabels: ["Tagesüberblick", "Mahlzeiten", "Hinweise"],
        notesFallback:
          "Bei Fragen zum Plan sprechen Sie bitte Ihre Ernährungsfachkraft an.",
      };
    case "lehrkueche":
      return {
        title: ctx.dietLineName
          ? `Lehrküchenplan – ${ctx.dietLineName}`
          : "Lehrküchenplan",
        fileBaseNamePrefix: "lehrkuechenplan",
        reportLength: "full" as const,
        selectedSections: { summary: true, table: false, charts: false, meals: true, notes: true },
        sectionLabels: ["Wochenüberblick", "Tagesgerichte", "Hinweise"],
        notesFallback: "Aushang Lehrküche/Stationsversorgung.",
      };
    case "clinical":
    default:
      return {
        title: `Klinischer Ernährungsbericht${patientLabel}`,
        fileBaseNamePrefix: "ernaehrungsplan-klinik",
        reportLength: "full" as const,
        selectedSections: { summary: true, table: true, charts: false, meals: true, notes: true },
        sectionLabels: ["Kurzfazit & Indikatoren", "Nährstofftabellen", "Speiseplanübersicht", "Individuelle Hinweise"],
        notesFallback: "Klinischer Tagesplan – Soll-/Ist-Abgleich auf Basis der gewählten Referenzwerte.",
      };
  }
}

export function buildDefaultReportExportRequest(
  plan: DailyMealPlan,
  recipes: Recipe[],
  foods: Food[],
  refConfig?: ResolvedReferenceConfig,
  context: MealPlanReportContext = {},
): ReportExportRequest {
  const variant = context.variant ?? "clinical";
  const variantConfig = buildVariantConfig(variant, context);

  const foodMap = new Map(foods.map((food) => [food.id, food]));
  const recipeMap = createRecipeLookup(recipes);
  const nutrientArrays = plan.slots.flatMap((slot) =>
    slot.entries.map((entry) => getEntryNutrients(entry, foodMap, recipeMap, foods)),
  );
  const planNutrients = sumNutrients(nutrientArrays.filter((values) => values.length > 0));
  const effectiveRefConfig =
    refConfig ??
    resolveReferenceForPatient({
      dateOfBirth: "1990-01-01",
      gender: "w",
    });

  const nutrientRows = variantConfig.selectedSections.table
    ? DEFAULT_NUTRIENT_IDS.map((id) => {
        const def = NUTRIENT_DEFINITIONS.find((item) => item.id === id)!;
        const value = getNutrientValue(planNutrients, id);
        const reference = getReferenceAmount(effectiveRefConfig, id);
        return {
          label: def.name,
          value: `${formatNumber(value, 1)} ${def.unit}`,
          reference: `${formatNumber(reference, 1)} ${def.unit}`,
          coverage: formatPercent(percentOfReference(value, reference)),
        };
      })
    : [];

  const vitaminRows = variantConfig.selectedSections.table
    ? NUTRIENT_DEFINITIONS.filter((item) => item.group === "vitamine")
        .slice(0, 6)
        .map((def) => {
          const value = getNutrientValue(planNutrients, def.id);
          const reference = getReferenceAmount(effectiveRefConfig, def.id);
          return {
            label: def.name,
            value: `${formatNumber(value, 1)} ${def.unit}`,
            reference: `${formatNumber(reference, 1)} ${def.unit}`,
            coverage: formatPercent(percentOfReference(value, reference)),
          };
        })
    : [];

  const mineralRows = variantConfig.selectedSections.table
    ? NUTRIENT_DEFINITIONS.filter((item) => item.group === "mineralstoffe")
        .slice(0, 6)
        .map((def) => {
          const value = getNutrientValue(planNutrients, def.id);
          const reference = getReferenceAmount(effectiveRefConfig, def.id);
          return {
            label: def.name,
            value: `${formatNumber(value, 1)} ${def.unit}`,
            reference: `${formatNumber(reference, 1)} ${def.unit}`,
            coverage: formatPercent(percentOfReference(value, reference)),
          };
        })
    : [];

  const energyValue = getNutrientValue(planNutrients, "energie");
  const energyReference = getReferenceAmount(effectiveRefConfig, "energie");
  const proteinValue = getNutrientValue(planNutrients, "eiweiss");
  const proteinReference = getReferenceAmount(effectiveRefConfig, "eiweiss");
  const fiber = getNutrientValue(planNutrients, "ballaststoffe");
  const fiberReference = getReferenceAmount(effectiveRefConfig, "ballaststoffe");

  const mealRows = plan.slots
    .filter((slot) => variant !== "patient" || slot.entries.length > 0)
    .map((slot) => ({
      slot: MEAL_SLOT_LABELS[slot.type],
      summary:
        slot.entries.length > 0
          ? slot.entries
              .map((entry) => describeEntry(entry, foodMap, recipeMap, variant))
              .join(", ")
          : variant === "patient"
            ? "—"
            : "noch offen",
    }));

  const totalWeight = plan.slots.reduce(
    (sum, slot) =>
      sum +
      slot.entries.reduce(
        (slotSum, entry) =>
          slotSum + (entry.type === "food" ? entry.amount : entry.amount * RECIPE_PORTION_WEIGHT_G),
        0,
      ),
    0,
  );

  const summaryMetrics = (() => {
    if (variant === "patient") {
      return [
        {
          label: "Energie",
          value: `${formatNumber(energyValue, 0)} kcal`,
          reference: `${formatNumber(energyReference, 0)} kcal`,
          coverage: formatPercent(percentOfReference(energyValue, energyReference)),
        },
        {
          label: "Eiweiß",
          value: `${formatNumber(proteinValue, 1)} g`,
          reference: `${formatNumber(proteinReference, 1)} g`,
          coverage: formatPercent(percentOfReference(proteinValue, proteinReference)),
        },
        {
          label: "Ballaststoffe",
          value: `${formatNumber(fiber, 1)} g`,
          reference: `${formatNumber(fiberReference, 1)} g`,
          coverage: formatPercent(percentOfReference(fiber, fiberReference)),
        },
      ];
    }
    return [
      {
        label: "Energieabdeckung",
        value: `${formatNumber(energyValue, 0)} kcal`,
        reference: `${formatNumber(energyReference, 0)} kcal`,
        coverage: formatPercent(percentOfReference(energyValue, energyReference)),
      },
      {
        label: "Ballaststoffe",
        value: `${formatNumber(fiber, 1)} g`,
        reference: `${formatNumber(fiberReference, 1)} g`,
        coverage: formatPercent(percentOfReference(fiber, fiberReference)),
      },
      {
        label: "Plangewicht",
        value: `${formatNumber(totalWeight, 0)} g`,
      },
    ];
  })();

  const narrative = (() => {
    if (variant === "patient") {
      const coverage = percentOfReference(energyValue, energyReference);
      return `Dieser Plan deckt rund ${formatPercent(coverage)} Ihres Energiebedarfs (${formatNumber(
        energyValue,
        0,
      )} kcal). Die Mahlzeiten sind so zusammengestellt, dass sie Ihren empfohlenen Tagesbedarf an Eiweiß und Ballaststoffen unterstützen.`;
    }
    return `Der vorliegende Tagesplan erreicht ${formatPercent(
      percentOfReference(energyValue, energyReference),
    )} des Energieziels (${formatNumber(energyValue, 0)} kcal von ${formatNumber(
      energyReference,
      0,
    )} kcal) und ${formatPercent(percentOfReference(proteinValue, proteinReference))} des Eiweißziels.`;
  })();

  const badges = [
    formatDate(plan.date),
    context.dietLineName,
    context.patientIndication,
    variant === "patient"
      ? "Patientenhandout"
      : variant === "lehrkueche"
        ? "Lehrküche"
        : "Klinik",
  ].filter((value): value is string => Boolean(value));

  const dateSlug = plan.date;
  const patientSlug = context.patientName
    ? `-${context.patientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`
    : "";

  return {
    format: "PDF",
    title: variantConfig.title,
    fileBaseName: `${variantConfig.fileBaseNamePrefix}${patientSlug}-${dateSlug}`,
    reportLength: variantConfig.reportLength,
    selectedSections: variantConfig.selectedSections,
    activeSectionLabels: variantConfig.sectionLabels,
    summaryMetrics,
    nutrientRows,
    vitaminRows,
    mineralRows,
    mealRows,
    notes: context.notes?.trim() || variantConfig.notesFallback,
    narrative,
    badges,
    specialNotes: variant === "patient"
      ? ["Bei Unverträglichkeiten oder Fragen melden Sie sich bitte in der Beratung."]
      : undefined,
    patientId: context.patientId,
    patientName: context.patientName,
    patientIndication: context.patientIndication,
    planId: context.planId ?? plan.id,
    planDateLabel: formatDate(plan.date),
  };
}

export interface TeachingKitchenContext {
  rangeLabel: string;
  dietLineName?: string;
  patientId?: string;
  patientName?: string;
  patientIndication?: string;
  planId?: string;
}

export function buildTeachingKitchenExportRequest(
  plans: DailyMealPlan[],
  recipes: Recipe[],
  foods: Food[],
  refConfig: ResolvedReferenceConfig | undefined,
  context: TeachingKitchenContext,
): ReportExportRequest {
  const foodMap = new Map(foods.map((food) => [food.id, food]));
  const recipeMap = createRecipeLookup(recipes);
  const effectiveRefConfig =
    refConfig ??
    resolveReferenceForPatient({
      dateOfBirth: "1990-01-01",
      gender: "w",
    });

  const dailyTotals = plans.map((plan) => {
    const nutrients = sumNutrients(
      plan.slots.flatMap((slot) =>
        slot.entries.map((entry) => getEntryNutrients(entry, foodMap, recipeMap, foods)),
      ),
    );
    return {
      plan,
      kcal: getNutrientValue(nutrients, "energie"),
      protein: getNutrientValue(nutrients, "eiweiss"),
    };
  });

  const totalKcal = dailyTotals.reduce((sum, day) => sum + day.kcal, 0);
  const avgKcal = dailyTotals.length > 0 ? totalKcal / dailyTotals.length : 0;
  const totalProtein = dailyTotals.reduce((sum, day) => sum + day.protein, 0);
  const avgProtein = dailyTotals.length > 0 ? totalProtein / dailyTotals.length : 0;
  const energyReference = getReferenceAmount(effectiveRefConfig, "energie");

  const formatSlotEntry = (
    plan: DailyMealPlan,
    slotType: "mittagessen" | "abendessen",
  ) => {
    const slot = plan.slots.find((item) => item.type === slotType);
    if (!slot || slot.entries.length === 0) {
      return slotType === "abendessen" ? "Buffet/Snack" : "noch offen";
    }
    return slot.entries
      .map((entry) => {
        if (entry.type === "food") {
          return foodMap.get(entry.referenceId)?.name ?? "Lebensmittel";
        }
        return recipeMap.get(entry.referenceId)?.name ?? "Rezept";
      })
      .slice(0, 2)
      .join(", ");
  };

  const mealRows = dailyTotals.map(({ plan, kcal }) => {
    const dateObj = new Date(`${plan.date}T00:00:00`);
    const dayShort = dateObj.toLocaleDateString("de-DE", { weekday: "short" });
    const dateShort = dateObj.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    return {
      slot: `${dayShort}, ${dateShort}`,
      summary: `Mittag: ${formatSlotEntry(plan, "mittagessen")} · Abend: ${formatSlotEntry(
        plan,
        "abendessen",
      )} · ${formatNumber(Math.round(kcal))} kcal`,
    };
  });

  const summaryMetrics = [
    {
      label: "Ø Energie / Tag",
      value: `${formatNumber(avgKcal, 0)} kcal`,
      reference: `${formatNumber(energyReference, 0)} kcal`,
      coverage: formatPercent(percentOfReference(avgKcal, energyReference)),
    },
    {
      label: "Ø Eiweiß / Tag",
      value: `${formatNumber(avgProtein, 1)} g`,
    },
    {
      label: "Tage im Plan",
      value: formatNumber(plans.length, 0),
    },
  ];

  const firstPlan = plans[0];
  const lastPlan = plans[plans.length - 1] ?? firstPlan;
  const fileSlug =
    firstPlan && lastPlan
      ? `${firstPlan.date}_${lastPlan.date}`
      : firstPlan?.date ?? "lehrkueche";

  const badges = [context.rangeLabel, context.dietLineName, "Lehrküche"].filter(
    (value): value is string => Boolean(value),
  );

  return {
    format: "PDF",
    title: context.dietLineName
      ? `Lehrküchenplan – ${context.dietLineName}`
      : "Lehrküchenplan",
    fileBaseName: `lehrkuechenplan-${fileSlug}`,
    reportLength: "full",
    selectedSections: { summary: true, table: false, charts: false, meals: true, notes: true },
    activeSectionLabels: ["Wochenüberblick", "Tagesgerichte", "Hinweise"],
    summaryMetrics,
    nutrientRows: [],
    vitaminRows: [],
    mineralRows: [],
    mealRows,
    notes:
      "Aushang für Lehrküche und Stationsversorgung. Mengen pro Portion sind in den Rezepten hinterlegt.",
    narrative: `Wochenplan für ${context.rangeLabel}. Durchschnittliche Energiezufuhr ${formatNumber(
      avgKcal,
      0,
    )} kcal/Tag.`,
    badges,
    patientId: context.patientId,
    patientName: context.patientName,
    patientIndication: context.patientIndication,
    planId: context.planId ?? firstPlan?.id,
    planDateLabel: context.rangeLabel,
  };
}
