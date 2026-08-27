import type {
  MealPlanTemplate,
  MealPlanTemplateDayBlock,
  MealSlot,
  MealSlotType,
} from "@/lib/types"

const SLOT_ORDER: MealSlotType[] = [
  "fruehstueck",
  "snack_vormittag",
  "mittagessen",
  "snack_nachmittag",
  "abendessen",
]

function createDay(
  prefix: string,
  recipes: Partial<Record<MealSlotType, string[]>>,
): MealSlot[] {
  return SLOT_ORDER.map((type) => ({
    type,
    entries: (recipes[type] ?? []).map((referenceId, index) => ({
      id: `${prefix}_${type}_${index + 1}`,
      type: "recipe" as const,
      referenceId,
      amount: 1,
    })),
  }))
}

function createMultiDayTemplate(
  template: Omit<MealPlanTemplate, "slots" | "dayBlocks">,
  dayBlocks: MealPlanTemplateDayBlock[],
): MealPlanTemplate {
  return {
    ...template,
    slots: dayBlocks[0]?.slots ?? [],
    dayBlocks,
  }
}

const diabetesDay = createDay("mock_diabetes", {
  fruehstueck: ["recipe_haferbrei"],
  mittagessen: ["recipe_haehnchen_salat"],
  abendessen: ["recipe_lachs_brokkoli"],
})

/**
 * Visible only with NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING=true. These fixtures
 * exercise the template UX without becoming ETL input or production content.
 */
export const LOCAL_TEST_MEAL_PLAN_TEMPLATES: MealPlanTemplate[] = [
  {
    id: "mock_template_patient_training_day",
    userId: "mock-local-user",
    patientId: "patient_1",
    name: "Test · Trainingstag für Maria",
    description: "Patientenspezifische Testvorlage für die Bereichsauswahl im Planer.",
    indication: "Adipositas",
    dietLineId: "diet_normal",
    sourceType: "personal",
    slots: createDay("mock_patient_training", {
      fruehstueck: ["recipe_haferbrei"],
      mittagessen: ["recipe_haehnchen_salat"],
      snack_nachmittag: ["recipe_vollkornbrot_quark"],
    }),
  },
  {
    id: "mock_template_diabetes_day",
    userId: "mock-local-user",
    name: "Test · Diabetes-Tagesplan",
    description: "Lokale Testvorlage für Suche, Vorschau und Ein-Tages-Konflikte.",
    indication: "Diabetes mellitus Typ 2",
    dietLineId: "diet_diabetes",
    sourceType: "personal",
    slots: diabetesDay,
  },
  createMultiDayTemplate(
    {
      id: "mock_template_vegetarian_three_days",
      userId: "mock-local-user",
      name: "Test · Vegetarische 3-Tage-Folge",
      description: "Drei zusammenhängende Planungstage zum Prüfen des vollständigen Mehrtagesablaufs.",
      indication: "Allgemein",
      dietLineId: "diet_normal",
      sourceType: "personal",
    },
    [
      {
        offsetDays: 0,
        slots: createDay("mock_veg_d1", {
          fruehstueck: ["recipe_haferbrei"],
          mittagessen: ["recipe_gemuese_reis"],
          abendessen: ["recipe_vollkornbrot_quark"],
        }),
      },
      {
        offsetDays: 1,
        slots: createDay("mock_veg_d2", {
          fruehstueck: ["recipe_vollkornbrot_quark"],
          mittagessen: ["recipe_linseneintopf"],
          abendessen: ["recipe_pasta_tomate"],
        }),
      },
      {
        offsetDays: 2,
        slots: createDay("mock_veg_d3", {
          fruehstueck: ["recipe_haferbrei"],
          mittagessen: ["recipe_pasta_tomate"],
          abendessen: ["recipe_kartoffelsuppe"],
        }),
      },
    ],
  ),
  createMultiDayTemplate(
    {
      id: "mock_template_workweek_gap",
      userId: "mock-local-user",
      name: "Test · Werktagsblock mit Lücke",
      description: "Drei Planungstage über fünf Kalendertage; Tag 3 und 4 bleiben bewusst frei.",
      indication: "Gewichtsmanagement",
      dietLineId: "diet_normal",
      sourceType: "personal",
    },
    [
      {
        offsetDays: 0,
        slots: createDay("mock_gap_d1", {
          fruehstueck: ["recipe_haferbrei"],
          mittagessen: ["recipe_haehnchen_salat"],
          abendessen: ["recipe_vollkornbrot_quark"],
        }),
      },
      {
        offsetDays: 1,
        slots: createDay("mock_gap_d2", {
          fruehstueck: ["recipe_vollkornbrot_quark"],
          mittagessen: ["recipe_lachs_brokkoli"],
          abendessen: ["recipe_kartoffelsuppe"],
        }),
      },
      {
        offsetDays: 4,
        slots: createDay("mock_gap_d5", {
          fruehstueck: ["recipe_haferbrei"],
          mittagessen: ["recipe_gemuese_reis"],
          abendessen: ["recipe_linseneintopf"],
        }),
      },
    ],
  ),
]
