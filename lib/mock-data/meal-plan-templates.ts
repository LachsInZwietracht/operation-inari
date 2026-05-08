import type { MealPlanTemplate } from "@/lib/types";

// Curated system templates by indication. References use legacy IDs that the
// recipes/meal-plan ETL resolves to canonical UUIDs (food_* → BLS code lookup,
// recipe_* → recipes.legacy_id lookup).
export const MEAL_PLAN_TEMPLATES: MealPlanTemplate[] = [
  {
    id: "template_normalkost",
    name: "Normalkost ausgewogen",
    description:
      "DGE-orientierte Vollkost als Startpunkt für allgemeine Ernährungsberatung.",
    indication: "Allgemein",
    dietLineId: "diet_normal",
    sourceType: "system",
    slots: [
      {
        type: "fruehstueck",
        entries: [
          { id: "tpl_norm_b1", type: "recipe", referenceId: "recipe_haferbrei", amount: 1 },
          { id: "tpl_norm_b2", type: "food", referenceId: "food_heidelbeere", amount: 100 },
        ],
      },
      {
        type: "snack_vormittag",
        entries: [
          { id: "tpl_norm_s1", type: "food", referenceId: "food_apfel", amount: 150 },
        ],
      },
      {
        type: "mittagessen",
        entries: [
          { id: "tpl_norm_l1", type: "recipe", referenceId: "recipe_gemuese_reis", amount: 1 },
        ],
      },
      {
        type: "snack_nachmittag",
        entries: [
          { id: "tpl_norm_a1", type: "food", referenceId: "food_joghurt", amount: 150 },
          { id: "tpl_norm_a2", type: "food", referenceId: "food_walnuesse", amount: 20 },
        ],
      },
      {
        type: "abendessen",
        entries: [
          { id: "tpl_norm_d1", type: "recipe", referenceId: "recipe_vollkornbrot_quark", amount: 1 },
        ],
      },
    ],
  },
  {
    id: "template_diabetes",
    name: "Diabetes (Typ 2) Tagesplan",
    description:
      "Kohlenhydrat- und ballaststoffbewusste Mahlzeiten mit niedriger glykämischer Last.",
    indication: "Diabetes mellitus Typ 2",
    dietLineId: "diet_diabetes",
    sourceType: "system",
    slots: [
      {
        type: "fruehstueck",
        entries: [
          { id: "tpl_dia_b1", type: "food", referenceId: "food_magerquark", amount: 200 },
          { id: "tpl_dia_b2", type: "food", referenceId: "food_haferflocken", amount: 30 },
          { id: "tpl_dia_b3", type: "food", referenceId: "food_heidelbeere", amount: 80 },
        ],
      },
      {
        type: "snack_vormittag",
        entries: [
          { id: "tpl_dia_s1", type: "food", referenceId: "food_walnuesse", amount: 20 },
        ],
      },
      {
        type: "mittagessen",
        entries: [
          { id: "tpl_dia_l1", type: "recipe", referenceId: "recipe_haehnchen_salat", amount: 1 },
        ],
      },
      {
        type: "snack_nachmittag",
        entries: [
          { id: "tpl_dia_a1", type: "food", referenceId: "food_gurke", amount: 100 },
          { id: "tpl_dia_a2", type: "food", referenceId: "food_paprika", amount: 100 },
        ],
      },
      {
        type: "abendessen",
        entries: [
          { id: "tpl_dia_d1", type: "recipe", referenceId: "recipe_lachs_brokkoli", amount: 1 },
        ],
      },
    ],
  },
  {
    id: "template_reduktion",
    name: "Reduktionskost (≈ 1500 kcal)",
    description: "Ausgewogene Kalorienreduktion für Gewichtsmanagement.",
    indication: "Adipositas",
    dietLineId: "diet_normal",
    sourceType: "system",
    slots: [
      {
        type: "fruehstueck",
        entries: [
          { id: "tpl_red_b1", type: "food", referenceId: "food_magerquark", amount: 150 },
          { id: "tpl_red_b2", type: "food", referenceId: "food_erdbeere", amount: 100 },
          { id: "tpl_red_b3", type: "food", referenceId: "food_haferflocken", amount: 25 },
        ],
      },
      {
        type: "snack_vormittag",
        entries: [],
      },
      {
        type: "mittagessen",
        entries: [
          { id: "tpl_red_l1", type: "recipe", referenceId: "recipe_haehnchen_salat", amount: 1 },
        ],
      },
      {
        type: "snack_nachmittag",
        entries: [
          { id: "tpl_red_a1", type: "food", referenceId: "food_apfel", amount: 150 },
        ],
      },
      {
        type: "abendessen",
        entries: [
          { id: "tpl_red_d1", type: "recipe", referenceId: "recipe_linseneintopf", amount: 1 },
        ],
      },
    ],
  },
  {
    id: "template_aufbau",
    name: "Aufbaukost / Sarkopenie",
    description:
      "Energie- und proteinreich strukturiert; sechs kleine Mahlzeiten mit Spätmahlzeit.",
    indication: "Mangelernährung",
    dietLineId: "diet_normal",
    sourceType: "system",
    slots: [
      {
        type: "fruehstueck",
        entries: [
          { id: "tpl_auf_b1", type: "recipe", referenceId: "recipe_vollkornbrot_quark", amount: 1 },
          { id: "tpl_auf_b2", type: "food", referenceId: "food_orangensaft", amount: 200 },
        ],
      },
      {
        type: "snack_vormittag",
        entries: [
          { id: "tpl_auf_s1", type: "food", referenceId: "food_banane", amount: 120 },
          { id: "tpl_auf_s2", type: "food", referenceId: "food_mandeln", amount: 30 },
        ],
      },
      {
        type: "mittagessen",
        entries: [
          { id: "tpl_auf_l1", type: "recipe", referenceId: "recipe_lachs_brokkoli", amount: 1 },
        ],
      },
      {
        type: "snack_nachmittag",
        entries: [
          { id: "tpl_auf_a1", type: "food", referenceId: "food_joghurt", amount: 200 },
          { id: "tpl_auf_a2", type: "food", referenceId: "food_walnuesse", amount: 25 },
        ],
      },
      {
        type: "abendessen",
        entries: [
          { id: "tpl_auf_d1", type: "recipe", referenceId: "recipe_pasta_tomate", amount: 1 },
        ],
      },
    ],
  },
  {
    id: "template_renal",
    name: "Niereninsuffizienz (Stadium 3)",
    description:
      "Eiweiß-, kalium- und phosphatangepasst; salzarm. Anpassung an Stadium und Verlauf erforderlich.",
    indication: "Niereninsuffizienz",
    dietLineId: "diet_renal",
    sourceType: "system",
    slots: [
      {
        type: "fruehstueck",
        entries: [
          { id: "tpl_ren_b1", type: "food", referenceId: "food_vollkornbrot", amount: 60 },
          { id: "tpl_ren_b2", type: "food", referenceId: "food_butter", amount: 10 },
          { id: "tpl_ren_b3", type: "food", referenceId: "food_apfel", amount: 120 },
        ],
      },
      {
        type: "snack_vormittag",
        entries: [
          { id: "tpl_ren_s1", type: "food", referenceId: "food_gurke", amount: 100 },
        ],
      },
      {
        type: "mittagessen",
        entries: [
          { id: "tpl_ren_l1", type: "recipe", referenceId: "recipe_kartoffelsuppe", amount: 1 },
        ],
      },
      {
        type: "snack_nachmittag",
        entries: [
          { id: "tpl_ren_a1", type: "food", referenceId: "food_erdbeere", amount: 100 },
        ],
      },
      {
        type: "abendessen",
        entries: [
          { id: "tpl_ren_d1", type: "food", referenceId: "food_kabeljau", amount: 100 },
          { id: "tpl_ren_d2", type: "food", referenceId: "food_zucchini", amount: 150 },
          { id: "tpl_ren_d3", type: "food", referenceId: "food_reis", amount: 80 },
        ],
      },
    ],
  },
  {
    id: "template_hypertonie",
    name: "DASH bei Hypertonie",
    description:
      "Salzarm, kalium- und magnesiumreich; pflanzlich betont nach DASH-Prinzip.",
    indication: "Arterielle Hypertonie",
    dietLineId: "diet_normal",
    sourceType: "system",
    slots: [
      {
        type: "fruehstueck",
        entries: [
          { id: "tpl_hyp_b1", type: "recipe", referenceId: "recipe_haferbrei", amount: 1 },
          { id: "tpl_hyp_b2", type: "food", referenceId: "food_banane", amount: 120 },
        ],
      },
      {
        type: "snack_vormittag",
        entries: [
          { id: "tpl_hyp_s1", type: "food", referenceId: "food_orange", amount: 150 },
        ],
      },
      {
        type: "mittagessen",
        entries: [
          { id: "tpl_hyp_l1", type: "recipe", referenceId: "recipe_linseneintopf", amount: 1 },
        ],
      },
      {
        type: "snack_nachmittag",
        entries: [
          { id: "tpl_hyp_a1", type: "food", referenceId: "food_joghurt", amount: 150 },
          { id: "tpl_hyp_a2", type: "food", referenceId: "food_heidelbeere", amount: 80 },
        ],
      },
      {
        type: "abendessen",
        entries: [
          { id: "tpl_hyp_d1", type: "recipe", referenceId: "recipe_gemuese_reis", amount: 1 },
        ],
      },
    ],
  },
];
