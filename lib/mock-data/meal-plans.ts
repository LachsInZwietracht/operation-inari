import { DailyMealPlan } from "@/lib/types";

export const MEAL_PLANS: DailyMealPlan[] = [
  {
    id: "plan_day1",
    date: "2026-04-07",
    slots: [
      {
        type: "fruehstueck",
        entries: [
          { id: "entry_d1_1", type: "recipe", referenceId: "recipe_haferbrei", amount: 1 },
        ],
      },
      {
        type: "snack_vormittag",
        entries: [
          { id: "entry_d1_2", type: "food", referenceId: "food_apfel", amount: 150 },
          { id: "entry_d1_3", type: "food", referenceId: "food_mandeln", amount: 30 },
        ],
      },
      {
        type: "mittagessen",
        entries: [
          { id: "entry_d1_4", type: "recipe", referenceId: "recipe_gemuese_reis", amount: 1 },
        ],
      },
      {
        type: "snack_nachmittag",
        entries: [
          { id: "entry_d1_5", type: "food", referenceId: "food_joghurt", amount: 150 },
          { id: "entry_d1_6", type: "food", referenceId: "food_banane", amount: 120 },
        ],
      },
      {
        type: "abendessen",
        entries: [
          { id: "entry_d1_7", type: "recipe", referenceId: "recipe_lachs_brokkoli", amount: 1 },
        ],
      },
    ],
  },
  {
    id: "plan_day2",
    date: "2026-04-08",
    slots: [
      {
        type: "fruehstueck",
        entries: [
          { id: "entry_d2_1", type: "recipe", referenceId: "recipe_vollkornbrot_quark", amount: 1 },
          { id: "entry_d2_2", type: "food", referenceId: "food_orangensaft", amount: 200 },
        ],
      },
      {
        type: "snack_vormittag",
        entries: [
          { id: "entry_d2_3", type: "food", referenceId: "food_banane", amount: 120 },
          { id: "entry_d2_4", type: "food", referenceId: "food_walnuesse", amount: 25 },
        ],
      },
      {
        type: "mittagessen",
        entries: [
          { id: "entry_d2_5", type: "recipe", referenceId: "recipe_linseneintopf", amount: 1 },
        ],
      },
      {
        type: "snack_nachmittag",
        entries: [
          { id: "entry_d2_6", type: "food", referenceId: "food_magerquark", amount: 150 },
          { id: "entry_d2_7", type: "food", referenceId: "food_erdbeere", amount: 100 },
        ],
      },
      {
        type: "abendessen",
        entries: [
          { id: "entry_d2_8", type: "recipe", referenceId: "recipe_pasta_tomate", amount: 1 },
        ],
      },
    ],
  },
];
