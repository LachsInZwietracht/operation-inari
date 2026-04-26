import { addDays, differenceInCalendarDays, parseISO } from "date-fns";

import { ALLERGEN_MAP } from "@/lib/allergen-constants";
import { DIET_FORMS } from "@/lib/reference-data/institution";
import type { InpatientStay, InstitutionMenu, MealCandidate, MealOrder, MealSlotType, Patient, PatientAllergenEntry, Recipe } from "@/lib/types";
import { MEAL_SLOT_LABELS } from "@/lib/constants";

const dietFormMap = new Map(DIET_FORMS.map((dietForm) => [dietForm.id, dietForm]));

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function getActiveInstitutionMenu(menus: InstitutionMenu[]) {
  return menus.find((menu) => menu.status === "active") ?? menus[0] ?? null;
}

export function getDefaultHospitalDate(menus: InstitutionMenu[]) {
  return getActiveInstitutionMenu(menus)?.startDate ?? new Date().toISOString().slice(0, 10);
}

export function getMenuWeekAndDay(menu: InstitutionMenu | null, date: string) {
  if (!menu) return null;

  const diff = differenceInCalendarDays(parseISO(date), parseISO(menu.startDate));
  if (diff < 0) return null;

  const cycleLengthDays = menu.cycleLength * 7;
  const cycleDiff = diff % cycleLengthDays;
  const weekNumber = Math.floor(cycleDiff / 7) + 1;
  const dayOfWeek = cycleDiff % 7;

  return { weekNumber, dayOfWeek };
}

export function getServiceMenuSlots(
  menu: InstitutionMenu | null,
  date: string,
  mealSlot: MealSlotType,
) {
  const resolved = getMenuWeekAndDay(menu, date);
  if (!menu || !resolved) return [];

  const week = menu.weeks.find((item) => item.weekNumber === resolved.weekNumber);
  const day = week?.days.find((item) => item.dayOfWeek === resolved.dayOfWeek);
  if (!day) return [];

  return day.dietMenus.flatMap((dietMenu) =>
    dietMenu.slots
      .filter((slot) => slot.type === mealSlot)
      .map((slot) => ({
        dietFormId: dietMenu.dietFormId,
        recipeId: slot.recipeId,
        portionCount: slot.portionCount,
      })),
  );
}

function getAllergenConflicts(recipe: Recipe, allergens: PatientAllergenEntry[]) {
  if (!recipe.allergens?.length || allergens.length === 0) return [];

  const recipeTokens = recipe.allergens.map((entry) => normalize(entry));
  return allergens
    .filter((entry) => entry.type !== "preference")
    .filter((entry) => {
      const definition = ALLERGEN_MAP.get(entry.allergenId);
      if (!definition) return false;
      return definition.foodMatchTokens.some((token) =>
        recipeTokens.some((recipeToken) => recipeToken.includes(normalize(token))),
      );
    })
    .map((entry) => ALLERGEN_MAP.get(entry.allergenId)?.label ?? entry.allergenId);
}

export function buildMealCandidates(params: {
  stay: InpatientStay;
  recipes: Recipe[];
  menu: InstitutionMenu | null;
  date: string;
  mealSlot: MealSlotType;
  allergens: PatientAllergenEntry[];
}): MealCandidate[] {
  const { stay, recipes, menu, date, mealSlot, allergens } = params;
  const serviceSlots = getServiceMenuSlots(menu, date, mealSlot);
  const recipeMap = new Map<string, Recipe>();
  for (const recipe of recipes) {
    recipeMap.set(recipe.id, recipe);
    if (recipe.legacyId) {
      recipeMap.set(recipe.legacyId, recipe);
    }
  }
  const grouped = new Map<string, { recipeName: string; dietFormIds: Set<string> }>();

  for (const slot of serviceSlots) {
    const recipe = recipeMap.get(slot.recipeId);
    if (!recipe) continue;

    const existing = grouped.get(slot.recipeId) ?? {
      recipeName: recipe.name,
      dietFormIds: new Set<string>(),
    };
    existing.dietFormIds.add(slot.dietFormId);
    grouped.set(slot.recipeId, existing);
  }

  if (grouped.size === 0 && menu) {
    for (const week of menu.weeks) {
      for (const day of week.days) {
        for (const dietMenu of day.dietMenus) {
          for (const slot of dietMenu.slots) {
            if (slot.type !== mealSlot) continue;
            const recipe = recipeMap.get(slot.recipeId);
            if (!recipe) continue;
            const existing = grouped.get(slot.recipeId) ?? {
              recipeName: recipe.name,
              dietFormIds: new Set<string>(),
            };
            existing.dietFormIds.add(dietMenu.dietFormId);
            grouped.set(slot.recipeId, existing);
          }
        }
      }
    }
  }

  return Array.from(grouped.entries()).map(([recipeId, value]) => {
    const recipe = recipeMap.get(recipeId);
    const dietFormIds = Array.from(value.dietFormIds);
    const blockedReasons: string[] = [];

    for (const dietFormId of stay.dietFormIds) {
      if (!value.dietFormIds.has(dietFormId)) {
        const form = dietFormMap.get(dietFormId);
        blockedReasons.push(`Nicht im Menü für ${form?.name ?? dietFormId}`);
      }
    }

    if (recipe) {
      const allergenConflicts = getAllergenConflicts(recipe, allergens);
      for (const label of allergenConflicts) {
        blockedReasons.push(`Allergenkonflikt: ${label}`);
      }
    }

    return {
      recipeId,
      recipeName: value.recipeName,
      dietFormIds,
      blockedReasons,
      isSelectable: blockedReasons.length === 0,
    };
  }).sort((a, b) => a.recipeName.localeCompare(b.recipeName, "de"));
}

export function buildRestrictionSummary(stay: InpatientStay, allergens: PatientAllergenEntry[]) {
  const dietRestrictions = stay.dietFormIds.map((dietFormId) => dietFormMap.get(dietFormId)?.name ?? dietFormId);
  const allergenRestrictions = allergens
    .filter((entry) => entry.type !== "preference")
    .map((entry) => ALLERGEN_MAP.get(entry.allergenId)?.label ?? entry.allergenId);

  return [...dietRestrictions, ...allergenRestrictions];
}

export function buildMealOrder(params: {
  existingOrder?: MealOrder;
  stay: InpatientStay;
  patient: Patient;
  candidate: MealCandidate;
  date: string;
  mealSlot: MealSlotType;
  allergens: PatientAllergenEntry[];
  specialInstructions?: string;
}): Omit<MealOrder, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  const { existingOrder, stay, patient, candidate, date, mealSlot, allergens, specialInstructions } = params;

  return {
    id: existingOrder?.id,
    legacyId: existingOrder?.legacyId,
    inpatientStayId: stay.id,
    patientId: stay.patientId,
    patientName: `${patient.firstName} ${patient.lastName}`,
    station: stay.station,
    room: stay.room,
    bed: stay.bed,
    date,
    mealSlot,
    recipeId: candidate.recipeId,
    recipeName: candidate.recipeName,
    dietFormIdsSnapshot: stay.dietFormIds,
    allergenIdsSnapshot: allergens.map((entry) => entry.allergenId),
    restrictionSummary: buildRestrictionSummary(stay, allergens),
    specialInstructions: specialInstructions?.trim() || undefined,
    status: existingOrder?.status ?? "pending",
  };
}

export function buildKitchenSummary(orders: MealOrder[]) {
  const grouped = new Map<string, {
    recipeId: string;
    recipeName: string;
    mealSlot: MealSlotType;
    patientNames: string[];
    totalPortions: number;
    specialInstructions: string[];
  }>();

  for (const order of orders) {
    const key = `${order.recipeId}:${order.mealSlot}`;
    const existing = grouped.get(key) ?? {
      recipeId: order.recipeId,
      recipeName: order.recipeName,
      mealSlot: order.mealSlot,
      patientNames: [],
      totalPortions: 0,
      specialInstructions: [],
    };
    existing.patientNames.push(order.patientName);
    existing.totalPortions += 1;
    if (order.specialInstructions) {
      existing.specialInstructions.push(order.specialInstructions);
    }
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).sort((a, b) => a.recipeName.localeCompare(b.recipeName, "de"));
}

export function getSelectedServiceLabel(date: string, mealSlot: MealSlotType) {
  return `${date} · ${MEAL_SLOT_LABELS[mealSlot]}`;
}

export function getTrayCardPrintUrl(params: { date: string; mealSlot: MealSlotType; station: string }) {
  const search = new URLSearchParams({
    date: params.date,
    mealSlot: params.mealSlot,
    station: params.station,
  });

  return `/institution/krankenhaus/tablettenkarten?${search.toString()}`;
}

export function getHospitalDatesForMenu(menu: InstitutionMenu | null) {
  if (!menu) return [];
  const dates: string[] = [];
  const totalDays = menu.cycleLength * 7;
  for (let index = 0; index < totalDays; index += 1) {
    dates.push(addDays(parseISO(menu.startDate), index).toISOString().slice(0, 10));
  }
  return dates;
}
