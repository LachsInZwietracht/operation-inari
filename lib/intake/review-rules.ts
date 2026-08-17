import { ALLERGEN_MAP } from "@/lib/allergen-constants"
import { DIET_EXCLUSION_LABELS, DIET_STYLE_LABELS } from "@/lib/diet-constants"
import { INTAKE_FOOD_PREFERENCE_MAP } from "@/lib/intake-food-preferences"
import { INTAKE_PRIMARY_GOAL_LABELS, readPrimaryGoals } from "@/lib/intake/schema"
import type { IntakePrimaryGoal, PatientIntakePayload } from "@/lib/types"

export interface IntakeReviewWarning {
  id: string
  title: string
  detail: string
}

const ANIMAL_FOODS = new Set([
  "haehnchen",
  "rind",
  "schwein",
  "lachs",
  "thunfisch",
  "garnelen",
  "eier",
  "quark",
  "skyr",
  "kaese",
  "milch",
  "butter",
])

const MEAT_AND_FISH = new Set([
  "haehnchen",
  "rind",
  "schwein",
  "lachs",
  "thunfisch",
  "garnelen",
])

const MEAT = new Set(["haehnchen", "rind", "schwein"])
const DAIRY = new Set(["quark", "skyr", "kaese", "milch", "butter"])

const ALLERGEN_FOOD_KEYS: Record<string, ReadonlySet<string>> = {
  gluten: new Set(["haferflocken", "nudeln", "vollkornbrot", "couscous"]),
  krebstiere: new Set(["garnelen"]),
  ei: new Set(["eier"]),
  fisch: new Set(["lachs", "thunfisch"]),
  soja: new Set(["tofu"]),
  milch: DAIRY,
  "schalenfrüchte": new Set(["nuesse"]),
}

function activeFoodKeys(payload: PatientIntakePayload): Set<string> {
  return new Set(
    (payload.foodPreferences ?? [])
      .filter((entry) => entry.rating === "gerne" || entry.rating === "geht")
      .map((entry) => entry.foodKey),
  )
}

function matchingFoods(keys: ReadonlySet<string>, active: ReadonlySet<string>): string[] {
  return [...keys]
    .filter((key) => active.has(key))
    .map((key) => INTAKE_FOOD_PREFERENCE_MAP.get(key)?.label ?? key)
}

/** Below this a difference is rounding, not an intention. */
const GOAL_WEIGHT_TOLERANCE_KG = 0.5

/**
 * Contradictions between the stated goals and the numbers next to them.
 *
 * Goals became multi-select, which is what makes "Abnehmen" and "Zunehmen" in
 * one submission possible at all. The weight checks catch the commoner slip:
 * someone types their current weight into the Wunschgewicht field, or misses
 * the decimal point.
 */
function findGoalWarnings(payload: PatientIntakePayload): IntakeReviewWarning[] {
  const warnings: IntakeReviewWarning[] = []
  const goals = readPrimaryGoals(payload.goal)
  const labels = (entries: IntakePrimaryGoal[]) =>
    entries.map((goal) => `„${INTAKE_PRIMARY_GOAL_LABELS[goal]}“`).join(" und ")

  const weightGoals = goals.filter((goal): goal is IntakePrimaryGoal =>
    goal === "abnehmen" || goal === "zunehmen" || goal === "gewicht_halten",
  )
  if (weightGoals.length > 1) {
    warnings.push({
      id: "goal-conflict",
      title: "Die Gewichtsziele widersprechen sich",
      detail: `Angegeben wurden ${labels(weightGoals)}. Bitte klären, was gelten soll.`,
    })
  }

  const { weightKg, goalWeightKg } = payload.body
  if (goalWeightKg !== undefined) {
    const difference = goalWeightKg - weightKg
    const stated = `Aktuell ${weightKg} kg, Wunschgewicht ${goalWeightKg} kg`

    if (goals.includes("abnehmen") && difference > GOAL_WEIGHT_TOLERANCE_KG) {
      warnings.push({
        id: "goal-weight-up-while-losing",
        title: "Wunschgewicht passt nicht zum Ziel",
        detail: `Als Ziel steht „Abnehmen“. ${stated} — das Wunschgewicht liegt darüber.`,
      })
    }
    if (goals.includes("zunehmen") && difference < -GOAL_WEIGHT_TOLERANCE_KG) {
      warnings.push({
        id: "goal-weight-down-while-gaining",
        title: "Wunschgewicht passt nicht zum Ziel",
        detail: `Als Ziel steht „Zunehmen“. ${stated} — das Wunschgewicht liegt darunter.`,
      })
    }
    if (
      goals.includes("gewicht_halten") &&
      Math.abs(difference) > GOAL_WEIGHT_TOLERANCE_KG
    ) {
      warnings.push({
        id: "goal-weight-while-holding",
        title: "Wunschgewicht passt nicht zum Ziel",
        detail: `Als Ziel steht „Gewicht halten“. ${stated} — das sind ${Math.abs(difference).toFixed(1)} kg Unterschied.`,
      })
    }
  }

  return warnings
}

/**
 * Finds plain data contradictions that need a human question before apply.
 * These are review prompts, not diagnoses or automatic clinical decisions.
 */
export function findIntakeReviewWarnings(
  payload: PatientIntakePayload,
): IntakeReviewWarning[] {
  const warnings: IntakeReviewWarning[] = []
  const active = activeFoodKeys(payload)
  const style = payload.diet?.style

  const addFoodWarning = (
    id: string,
    title: string,
    restricted: ReadonlySet<string>,
    reason: string,
  ) => {
    const foods = matchingFoods(restricted, active)
    if (foods.length === 0) return
    warnings.push({
      id,
      title,
      detail: `${reason}. Gleichzeitig wurden ${foods.join(", ")} als „Gerne“ oder „Geht“ markiert.`,
    })
  }

  if (style === "vegan") {
    addFoodWarning(
      "style-vegan",
      "Ernährungsform und Lebensmittel passen nicht zusammen",
      ANIMAL_FOODS,
      `Als Ernährungsform steht „${DIET_STYLE_LABELS[style]}“`,
    )
  } else if (style === "vegetarisch") {
    addFoodWarning(
      "style-vegetarian",
      "Ernährungsform und Lebensmittel passen nicht zusammen",
      MEAT_AND_FISH,
      `Als Ernährungsform steht „${DIET_STYLE_LABELS[style]}“`,
    )
  } else if (style === "pescetarisch") {
    addFoodWarning(
      "style-pescetarian",
      "Ernährungsform und Lebensmittel passen nicht zusammen",
      MEAT,
      `Als Ernährungsform steht „${DIET_STYLE_LABELS[style]}“`,
    )
  }

  const exclusions = new Set(payload.diet?.exclusions ?? [])
  if (exclusions.has("halal") || exclusions.has("no_pork")) {
    const label = exclusions.has("halal")
      ? DIET_EXCLUSION_LABELS.halal
      : DIET_EXCLUSION_LABELS.no_pork
    addFoodWarning(
      "exclusion-pork",
      "Ausschluss und Lebensmittel passen nicht zusammen",
      new Set(["schwein"]),
      `Als Vorgabe steht „${label}“`,
    )
  }
  if (exclusions.has("no_red_meat")) {
    addFoodWarning(
      "exclusion-red-meat",
      "Ausschluss und Lebensmittel passen nicht zusammen",
      new Set(["rind", "schwein"]),
      `Als Vorgabe steht „${DIET_EXCLUSION_LABELS.no_red_meat}“`,
    )
  }
  if (exclusions.has("no_dairy")) {
    addFoodWarning(
      "exclusion-dairy",
      "Ausschluss und Lebensmittel passen nicht zusammen",
      DAIRY,
      `Als Vorgabe steht „${DIET_EXCLUSION_LABELS.no_dairy}“`,
    )
  }

  warnings.push(...findGoalWarnings(payload))

  for (const allergen of payload.allergens ?? []) {
    const restricted = ALLERGEN_FOOD_KEYS[allergen.allergenId]
    if (!restricted) continue
    const foods = matchingFoods(restricted, active)
    if (foods.length === 0) continue
    const label = ALLERGEN_MAP.get(allergen.allergenId)?.label ?? allergen.allergenId
    warnings.push({
      id: `allergen-${allergen.allergenId}`,
      title: "Unverträglichkeit und Lebensmittel müssen geklärt werden",
      detail: `${label} wurde als ${allergen.type === "allergy" ? "Allergie" : "Intoleranz"} angegeben. Gleichzeitig wurden ${foods.join(", ")} als „Gerne“ oder „Geht“ markiert.`,
    })
  }

  return warnings
}
