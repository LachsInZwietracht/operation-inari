import { ALLERGEN_MAP } from "@/lib/allergen-constants"
import { DIET_EXCLUSION_LABELS, DIET_STYLE_LABELS } from "@/lib/diet-constants"
import { INTAKE_FOOD_PREFERENCE_MAP } from "@/lib/intake-food-preferences"
import type { PatientIntakePayload } from "@/lib/types"

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
