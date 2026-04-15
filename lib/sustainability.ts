import type { DailyMealPlan, Food, MealEntry, MealSlotType, Recipe } from "@/lib/types"

const CATEGORY_CO2_FACTORS: Record<string, number> = {
  cat_gemuese: 1.2,
  cat_obst: 1.1,
  cat_getreide: 1.8,
  cat_huelsenfruechte: 1.5,
  cat_nuesse: 2.6,
  cat_oele: 3.2,
  cat_fisch: 5.4,
  cat_fleisch: 13.5,
  cat_milch: 3.5,
  cat_eier: 4.8,
  cat_getraenke: 0.8,
  cat_gewuerze: 0.6,
  cat_fruehstueck: 1.9,
  cat_snacks: 2.4,
  cat_fertiggerichte: 4.2,
  cat_unbekannt: 2.2,
}

const PLANT_BASED_CATEGORIES = new Set([
  "cat_gemuese",
  "cat_obst",
  "cat_getreide",
  "cat_huelsenfruechte",
  "cat_nuesse",
  "cat_oele",
  "cat_gewuerze",
  "cat_fruehstueck",
  "cat_snacks",
])

const ANIMAL_BASED_CATEGORIES = new Set([
  "cat_fleisch",
  "cat_fisch",
  "cat_milch",
  "cat_eier",
])

interface EntryFootprint {
  id: string
  label: string
  slot: MealSlotType
  co2: number
}

export interface SustainabilityBreakdown {
  totalCo2: number
  perSlot: Array<{ slot: MealSlotType; value: number }>
  plantShare: number
  animalShare: number
  topEmitters: EntryFootprint[]
}

export function estimateFoodCo2(food: Food, amountGrams: number): number {
  const factor = CATEGORY_CO2_FACTORS[food.categoryId] ?? 2.2
  return ((amountGrams / 1000) * factor)
}

export function estimateRecipeCo2(recipe: Recipe, foods: Food[]): number {
  if (recipe.co2PerPortion) return recipe.co2PerPortion
  const foodMap = new Map(foods.map((f) => [f.id, f]))
  const total = recipe.ingredients.reduce((sum, ingredient) => {
    const food = foodMap.get(ingredient.foodId)
    if (!food) return sum
    return sum + estimateFoodCo2(food, ingredient.amount)
  }, 0)
  return recipe.servings > 0 ? total / recipe.servings : total
}

function entryFootprint(entry: MealEntry, slot: MealSlotType, foods: Food[], recipes: Recipe[]): number {
  if (entry.type === "food") {
    const food = foods.find((f) => f.id === entry.referenceId)
    if (!food) return 0
    return estimateFoodCo2(food, entry.amount)
  }

  const recipe = recipes.find((r) => r.id === entry.referenceId || r.legacyId === entry.referenceId)
  if (!recipe) return 0
  const perServing = estimateRecipeCo2(recipe, foods)
  return perServing * entry.amount
}

function entryLabel(entry: MealEntry, foods: Food[], recipes: Recipe[]): string {
  if (entry.type === "food") {
    const food = foods.find((f) => f.id === entry.referenceId)
    return food?.name ?? "Lebensmittel"
  }
  const recipe = recipes.find((r) => r.id === entry.referenceId || r.legacyId === entry.referenceId)
  return recipe?.name ?? "Rezept"
}

export function evaluatePlanSustainability(
  plan: DailyMealPlan,
  foods: Food[],
  recipes: Recipe[],
): SustainabilityBreakdown {
  const foodMap = new Map(foods.map((f) => [f.id, f]))

  let total = 0
  let plantMass = 0
  let animalMass = 0
  const perSlot: Array<{ slot: MealSlotType; value: number }> = []
  const emitterList: EntryFootprint[] = []

  for (const slot of plan.slots) {
    let slotValue = 0
    for (const entry of slot.entries) {
      const co2 = entryFootprint(entry, slot.type, foods, recipes)
      total += co2
      slotValue += co2
      emitterList.push({
        id: entry.id,
        label: entryLabel(entry, foods, recipes),
        slot: slot.type,
        co2,
      })

      if (entry.type === "food") {
        const food = foodMap.get(entry.referenceId)
        if (food) {
          const massKg = entry.amount / 1000
          if (PLANT_BASED_CATEGORIES.has(food.categoryId)) {
            plantMass += massKg
          } else if (ANIMAL_BASED_CATEGORIES.has(food.categoryId)) {
            animalMass += massKg
          }
        }
      }
    }
    perSlot.push({ slot: slot.type, value: slotValue })
  }

  const totalMass = plantMass + animalMass
  const plantShare = totalMass > 0 ? plantMass / totalMass : 0
  const animalShare = totalMass > 0 ? animalMass / totalMass : 0

  emitterList.sort((a, b) => b.co2 - a.co2)

  return {
    totalCo2: Number(total.toFixed(2)),
    perSlot: perSlot.map((item) => ({ ...item, value: Number(item.value.toFixed(2)) })),
    plantShare,
    animalShare,
    topEmitters: emitterList.slice(0, 4).map((item) => ({
      ...item,
      co2: Number(item.co2.toFixed(2)),
    })),
  }
}
