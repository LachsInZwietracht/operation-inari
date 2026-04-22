import { addDays, parseISO } from "date-fns";

import { NUTRIENT_DEFINITIONS } from "@/lib/data/nutrient-definitions";
import { DIET_FORMS } from "@/lib/mock-data";
import { getNutrientValue, scaleNutrients, sumNutrients } from "@/lib/nutrients";
import type {
  ComplianceResult,
  CostAnalysis,
  DayCompliance,
  DietFormCount,
  Food,
  InpatientStay,
  InstitutionMenu,
  InstitutionOverviewStats,
  MealOrder,
  NutrientValue,
  PatientAllergenEntry,
  Recipe,
} from "@/lib/types";

const DEFAULT_COST_PER_KG = 6;
const CATEGORY_COST_PER_KG: Record<string, number> = {
  cat_gemuese: 4,
  cat_obst: 6,
  cat_fleisch: 12,
  cat_fisch: 15,
  cat_milch: 5,
  cat_eier: 7,
  cat_getreide: 4,
  cat_huelsenfruechte: 6,
  cat_nuesse: 14,
  cat_oele: 10,
  cat_getraenke: 2,
  cat_gewuerze: 30,
  cat_fruehstueck: 5,
  cat_snacks: 8,
  cat_fertiggerichte: 8,
  cat_unbekannt: DEFAULT_COST_PER_KG,
  cat_sonstiges: DEFAULT_COST_PER_KG,
};

const NUTRIENT_MAP = new Map(NUTRIENT_DEFINITIONS.map((definition) => [definition.id, definition]));
const DIET_FORM_MAP = new Map(DIET_FORMS.map((dietForm) => [dietForm.id, dietForm]));
const FULFILLMENT_STATUS_LABELS: Record<MealOrder["status"], string> = {
  pending: "Ausstehend",
  confirmed: "Bestätigt",
  delivered: "Ausgeliefert",
  cancelled: "Storniert",
};

export interface FulfillmentSummaryItem {
  status: MealOrder["status"];
  label: string;
  count: number;
}

export interface FulfillmentByDateItem {
  date: string;
  pending: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
}

export interface TopRecipeOrderStat {
  recipeId: string;
  recipeName: string;
  count: number;
}

export interface ComplianceDateGroup {
  date: string;
  entries: DayCompliance[];
  averageScore: number;
}

export interface InstitutionAnalyticsResult {
  activeMenu: InstitutionMenu | null;
  cycleDates: string[];
  complianceRows: DayCompliance[];
  complianceByDate: ComplianceDateGroup[];
  dietFormCounts: DietFormCount[];
  topRecipes: TopRecipeOrderStat[];
  fulfillmentStats: FulfillmentSummaryItem[];
  fulfillmentByDate: FulfillmentByDateItem[];
  costAnalysis: CostAnalysis[];
  overview: InstitutionOverviewStats;
  complianceAverage: number;
  totalCycleCost: number;
  cheapestDay: CostAnalysis | null;
  mostExpensiveDay: CostAnalysis | null;
  activeStayCount: number;
  activeAllergenProfileCount: number;
  restrictedStayCount: number;
  ordersWithRestrictions: number;
}

export function collectActiveMenuFoodIds(menus: InstitutionMenu[], recipes: Recipe[]) {
  const activeMenu = menus.find((menu) => menu.status === "active") ?? menus[0] ?? null;
  if (!activeMenu) return [];

  const recipeMap = new Map<string, Recipe>();
  for (const recipe of recipes) {
    recipeMap.set(recipe.id, recipe);
    if (recipe.legacyId) {
      recipeMap.set(recipe.legacyId, recipe);
    }
  }

  const foodIds = new Set<string>();
  for (const week of activeMenu.weeks) {
    for (const day of week.days) {
      for (const dietMenu of day.dietMenus) {
        for (const slot of dietMenu.slots) {
          const recipe = recipeMap.get(slot.recipeId);
          if (!recipe) continue;
          for (const ingredient of recipe.ingredients) {
            foodIds.add(ingredient.foodId);
          }
        }
      }
    }
  }

  return Array.from(foodIds);
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getCompletionPercentage(actual: number, target?: number, min?: number, max?: number) {
  if (target && target > 0) {
    return (actual / target) * 100;
  }
  if (min && min > 0) {
    return (actual / min) * 100;
  }
  if (max && max > 0) {
    if (actual <= max) return 100;
    return (max / actual) * 100;
  }
  return 100;
}

function getComplianceScore(actual: number, target?: number, min?: number, max?: number) {
  if (min != null && actual < min) {
    return clamp((actual / min) * 100, 0, 100);
  }
  if (max != null && actual > max) {
    return clamp((max / actual) * 100, 0, 100);
  }
  if (target != null && target > 0) {
    const deviation = Math.abs(actual - target) / target;
    return clamp(100 - deviation * 100, 0, 100);
  }
  return 100;
}

function getComplianceStatus(score: number): ComplianceResult["status"] {
  if (score >= 85) return "ok";
  if (score >= 70) return "warning";
  return "critical";
}

function getRecipeTotalNutrients(recipe: Recipe, foodMap: Map<string, Food>): NutrientValue[] {
  const scaledArrays: NutrientValue[][] = [];

  for (const ingredient of recipe.ingredients) {
    const food = foodMap.get(ingredient.foodId);
    if (!food) continue;
    scaledArrays.push(scaleNutrients(food.nutrients, food.baseAmount, ingredient.amount));
  }

  return sumNutrients(scaledArrays);
}

function getCostPerKg(categoryId?: string) {
  if (!categoryId) return DEFAULT_COST_PER_KG;
  return CATEGORY_COST_PER_KG[categoryId] ?? DEFAULT_COST_PER_KG;
}

function getCycleDates(menu: InstitutionMenu | null) {
  if (!menu) return [];

  return Array.from({ length: menu.cycleLength * 7 }, (_, index) =>
    formatDateKey(addDays(parseISO(menu.startDate), index)),
  );
}

function getMenuDay(menu: InstitutionMenu, dayIndex: number) {
  const weekNumber = Math.floor(dayIndex / 7) + 1;
  const dayOfWeek = dayIndex % 7;
  const week = menu.weeks.find((entry) => entry.weekNumber === weekNumber);
  const day = week?.days.find((entry) => entry.dayOfWeek === dayOfWeek);
  return { weekNumber, dayOfWeek, day };
}

export function buildInstitutionAnalytics(params: {
  menus: InstitutionMenu[];
  recipes: Recipe[];
  foods: Food[];
  stays: InpatientStay[];
  orders: MealOrder[];
  patientAllergens: PatientAllergenEntry[];
}): InstitutionAnalyticsResult {
  const { menus, recipes, foods, stays, orders, patientAllergens } = params;
  const activeMenu = menus.find((menu) => menu.status === "active") ?? menus[0] ?? null;
  const cycleDates = getCycleDates(activeMenu);
  const cycleDateSet = new Set(cycleDates);
  const foodMap = new Map(foods.map((food) => [food.id, food]));
  const recipeMap = new Map<string, Recipe>();

  for (const recipe of recipes) {
    recipeMap.set(recipe.id, recipe);
    if (recipe.legacyId) {
      recipeMap.set(recipe.legacyId, recipe);
    }
  }

  const recipeTotals = new Map<string, NutrientValue[]>();
  for (const recipe of recipes) {
    recipeTotals.set(recipe.id, getRecipeTotalNutrients(recipe, foodMap));
  }

  const complianceRows: DayCompliance[] = [];
  const costAnalysis: CostAnalysis[] = [];

  if (activeMenu) {
    cycleDates.forEach((date, dayIndex) => {
      const { day } = getMenuDay(activeMenu, dayIndex);
      const nutrientTotalsByDietForm = new Map<string, NutrientValue[]>();
      let totalCost = 0;
      let portionCount = 0;

      for (const dietMenu of day?.dietMenus ?? []) {
        const nutrientArrays: NutrientValue[][] = [];

        for (const slot of dietMenu.slots) {
          const recipe = recipeMap.get(slot.recipeId);
          if (!recipe) continue;

          const recipeNutrients = recipeTotals.get(recipe.id) ?? [];
          const servings = Math.max(recipe.servings, 1);
          nutrientArrays.push(recipeNutrients.map((value) => ({
            nutrientId: value.nutrientId,
            amount: (value.amount / servings) * slot.portionCount,
          })));

          const scale = slot.portionCount / servings;
          for (const ingredient of recipe.ingredients) {
            const food = foodMap.get(ingredient.foodId);
            const amount = ingredient.amount * scale;
            const categoryId = food?.categoryId;
            totalCost += (amount / 1000) * getCostPerKg(categoryId);
          }

          portionCount += slot.portionCount;
        }

        const dayTotals = sumNutrients(nutrientArrays);
        nutrientTotalsByDietForm.set(dietMenu.dietFormId, dayTotals);
      }

      for (const [dietFormId, totals] of nutrientTotalsByDietForm.entries()) {
        const dietForm = DIET_FORM_MAP.get(dietFormId);
        if (!dietForm || dietForm.nutrientTargets.length === 0) continue;

        const results: ComplianceResult[] = dietForm.nutrientTargets.map((targetDefinition) => {
          const nutrientDefinition = NUTRIENT_MAP.get(targetDefinition.nutrientId);
          const actual = getNutrientValue(totals, targetDefinition.nutrientId);
          const target = targetDefinition.target ?? targetDefinition.min ?? targetDefinition.max ?? 0;
          const score = getComplianceScore(actual, targetDefinition.target, targetDefinition.min, targetDefinition.max);

          return {
            nutrientId: targetDefinition.nutrientId,
            nutrientName: nutrientDefinition?.name ?? targetDefinition.nutrientId,
            unit: nutrientDefinition?.unit ?? "",
            actual: round(actual, 1),
            target: round(target, 1),
            min: targetDefinition.min,
            max: targetDefinition.max,
            percentage: round(getCompletionPercentage(actual, targetDefinition.target, targetDefinition.min, targetDefinition.max), 1),
            status: getComplianceStatus(score),
          };
        });

        const overallScore = round(
          results.reduce((sum, result) => {
            const targetDefinition = dietForm.nutrientTargets.find((entry) => entry.nutrientId === result.nutrientId);
            return sum + getComplianceScore(result.actual, targetDefinition?.target, targetDefinition?.min, targetDefinition?.max);
          }, 0) / Math.max(results.length, 1),
          1,
        );

        complianceRows.push({
          date,
          dietFormId,
          overallScore,
          results,
        });
      }

      costAnalysis.push({
        date,
        totalCost: round(totalCost, 2),
        portionCount,
        costPerPortion: portionCount > 0 ? round(totalCost / portionCount, 2) : 0,
      });
    });
  }

  const complianceByDate = cycleDates
    .map((date) => {
      const entries = complianceRows.filter((row) => row.date === date);
      if (entries.length === 0) {
        return null;
      }

      return {
        date,
        entries,
        averageScore: round(entries.reduce((sum, entry) => sum + entry.overallScore, 0) / entries.length, 1),
      };
    })
    .filter((entry): entry is ComplianceDateGroup => entry !== null);

  const complianceAverage = complianceRows.length > 0
    ? round(complianceRows.reduce((sum, row) => sum + row.overallScore, 0) / complianceRows.length, 1)
    : 0;

  const activeStays = stays.filter((stay) => stay.status === "active");
  const allergensByPatient = new Map<string, PatientAllergenEntry[]>();
  for (const entry of patientAllergens) {
    const existing = allergensByPatient.get(entry.patientId) ?? [];
    existing.push(entry);
    allergensByPatient.set(entry.patientId, existing);
  }

  const totalDietAssignments = activeStays.reduce((sum, stay) => sum + stay.dietFormIds.length, 0);
  const dietFormCounts = Array.from(
    activeStays.reduce((map, stay) => {
      for (const dietFormId of stay.dietFormIds) {
        map.set(dietFormId, (map.get(dietFormId) ?? 0) + 1);
      }
      return map;
    }, new Map<string, number>()),
  )
    .map(([dietFormId, count]) => ({
      dietFormId,
      dietFormName: DIET_FORM_MAP.get(dietFormId)?.name ?? dietFormId,
      count,
      percentage: totalDietAssignments > 0 ? round((count / totalDietAssignments) * 100, 1) : 0,
    }))
    .sort((a, b) => b.count - a.count || a.dietFormName.localeCompare(b.dietFormName, "de"));

  const activeCycleOrders = orders.filter((order) => cycleDateSet.has(order.date));
  const topRecipes = Array.from(
    activeCycleOrders.reduce((map, order) => {
      const existing = map.get(order.recipeId) ?? { recipeId: order.recipeId, recipeName: order.recipeName, count: 0 };
      existing.count += 1;
      map.set(order.recipeId, existing);
      return map;
    }, new Map<string, TopRecipeOrderStat>()),
  )
    .map(([, value]) => value)
    .sort((a, b) => b.count - a.count || a.recipeName.localeCompare(b.recipeName, "de"))
    .slice(0, 8);

  const fulfillmentStats = (Object.keys(FULFILLMENT_STATUS_LABELS) as MealOrder["status"][]).map((status) => ({
    status,
    label: FULFILLMENT_STATUS_LABELS[status],
    count: activeCycleOrders.filter((order) => order.status === status).length,
  }));

  const fulfillmentByDate = cycleDates.map((date) => {
    const dailyOrders = activeCycleOrders.filter((order) => order.date === date);
    return {
      date,
      pending: dailyOrders.filter((order) => order.status === "pending").length,
      confirmed: dailyOrders.filter((order) => order.status === "confirmed").length,
      delivered: dailyOrders.filter((order) => order.status === "delivered").length,
      cancelled: dailyOrders.filter((order) => order.status === "cancelled").length,
    };
  });

  const totalCycleCost = round(costAnalysis.reduce((sum, item) => sum + item.totalCost, 0), 2);
  const cheapestDay = costAnalysis.length > 0
    ? costAnalysis.reduce((current, item) => (item.totalCost < current.totalCost ? item : current), costAnalysis[0])
    : null;
  const mostExpensiveDay = costAnalysis.length > 0
    ? costAnalysis.reduce((current, item) => (item.totalCost > current.totalCost ? item : current), costAnalysis[0])
    : null;

  const knownBedCount = new Set(stays.map((stay) => `${stay.station}:${stay.room}:${stay.bed}`)).size;
  const occupiedBedCount = new Set(activeStays.map((stay) => `${stay.station}:${stay.room}:${stay.bed}`)).size;
  const activeAllergenProfileCount = activeStays.filter((stay) => (allergensByPatient.get(stay.patientId)?.length ?? 0) > 0).length;
  const restrictedStayCount = activeStays.filter((stay) => stay.dietFormIds.length > 1 || (allergensByPatient.get(stay.patientId)?.length ?? 0) > 0).length;
  const activeDietForms = new Set([
    ...activeStays.flatMap((stay) => stay.dietFormIds),
    ...(activeMenu?.dietFormIds ?? []),
  ]).size;

  const totalPortions = costAnalysis.reduce((sum, item) => sum + item.portionCount, 0);
  const overview: InstitutionOverviewStats = {
    totalBeds: knownBedCount,
    occupiedBeds: occupiedBedCount,
    occupancyRate: knownBedCount > 0 ? round((occupiedBedCount / knownBedCount) * 100, 1) : 0,
    activeDietForms,
    averageCostPerDay: costAnalysis.length > 0 ? round(totalCycleCost / costAnalysis.length, 2) : 0,
    averageCostPerPortion: totalPortions > 0 ? round(totalCycleCost / totalPortions, 2) : 0,
    complianceRate: complianceAverage,
    pendingOrders: activeCycleOrders.filter((order) => order.status === "pending").length,
  };

  return {
    activeMenu,
    cycleDates,
    complianceRows,
    complianceByDate,
    dietFormCounts,
    topRecipes,
    fulfillmentStats,
    fulfillmentByDate,
    costAnalysis,
    overview,
    complianceAverage,
    totalCycleCost,
    cheapestDay,
    mostExpensiveDay,
    activeStayCount: activeStays.length,
    activeAllergenProfileCount,
    restrictedStayCount,
    ordersWithRestrictions: activeCycleOrders.filter(
      (order) => order.restrictionSummary.length > 0 || order.allergenIdsSnapshot.length > 0,
    ).length,
  };
}
