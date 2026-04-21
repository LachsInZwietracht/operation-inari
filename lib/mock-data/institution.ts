import type {
  DietForm,
  InstitutionMenu,
  HospitalBed,
  DietaryOrder,
  InpatientStay,
  MealOrder,
  ProductionList,
  ShoppingList,
  InstitutionOverviewStats,
  DietFormCount,
  MenuChoiceStat,
  CostAnalysis,
  DayCompliance,
} from "@/lib/types";

const ts = { createdAt: "2026-03-01T00:00:00Z", updatedAt: "2026-03-01T00:00:00Z" };

// ──────────────────────────────────────────────
// Diet forms (Kostformen)
// ──────────────────────────────────────────────

export const DIET_FORMS: DietForm[] = [
  {
    id: "diet_vollkost",
    name: "Vollkost",
    shortName: "VK",
    category: "standard",
    description: "Ausgewogene Vollkost nach DGE-Empfehlungen",
    nutrientTargets: [
      { nutrientId: "energie", target: 2000, min: 1800, max: 2200 },
      { nutrientId: "eiweiss", target: 60, min: 50, max: 80 },
      { nutrientId: "fett", target: 65, min: 55, max: 80 },
      { nutrientId: "kohlenhydrate", target: 250, min: 220, max: 300 },
      { nutrientId: "ballaststoffe", target: 30, min: 25 },
      { nutrientId: "natrium", max: 2300 },
    ],
    allergenExclusions: [],
    isActive: true,
  },
  {
    id: "diet_leichte_vollkost",
    name: "Leichte Vollkost",
    shortName: "LVK",
    category: "standard",
    description: "Gut verträgliche Kost, vermeidet blähende und stark gewürzte Speisen",
    nutrientTargets: [
      { nutrientId: "energie", target: 1800, min: 1600, max: 2000 },
      { nutrientId: "eiweiss", target: 55, min: 45, max: 70 },
      { nutrientId: "fett", target: 60, min: 50, max: 70 },
      { nutrientId: "kohlenhydrate", target: 230, min: 200, max: 270 },
      { nutrientId: "ballaststoffe", target: 25, min: 20 },
    ],
    allergenExclusions: [],
    isActive: true,
  },
  {
    id: "diet_diabetes",
    name: "Diabeteskost",
    shortName: "DK",
    category: "diabetes",
    description: "Kohlenhydratkontrollierte Kost für Diabetes mellitus",
    nutrientTargets: [
      { nutrientId: "energie", target: 1800, min: 1600, max: 2000 },
      { nutrientId: "eiweiss", target: 70, min: 60, max: 90 },
      { nutrientId: "fett", target: 55, min: 45, max: 65 },
      { nutrientId: "kohlenhydrate", target: 200, min: 170, max: 230 },
      { nutrientId: "zucker", max: 30 },
      { nutrientId: "ballaststoffe", target: 35, min: 30 },
    ],
    allergenExclusions: [],
    isActive: true,
  },
  {
    id: "diet_nieren",
    name: "Nierendiät",
    shortName: "ND",
    category: "renal",
    description: "Protein- und kaliumreduzierte Kost bei Niereninsuffizienz",
    nutrientTargets: [
      { nutrientId: "energie", target: 2000, min: 1800, max: 2200 },
      { nutrientId: "eiweiss", target: 40, min: 35, max: 50 },
      { nutrientId: "kalium", max: 2000 },
      { nutrientId: "phosphor", max: 1000 },
      { nutrientId: "natrium", max: 2000 },
    ],
    allergenExclusions: [],
    isActive: true,
  },
  {
    id: "diet_glutenfrei",
    name: "Glutenfreie Kost",
    shortName: "GF",
    category: "allergen",
    description: "Strikter Ausschluss glutenhaltiger Getreide",
    nutrientTargets: [
      { nutrientId: "energie", target: 2000, min: 1800, max: 2200 },
      { nutrientId: "eiweiss", target: 60, min: 50, max: 80 },
      { nutrientId: "ballaststoffe", target: 25, min: 20 },
    ],
    allergenExclusions: ["Gluten"],
    isActive: true,
  },
  {
    id: "diet_laktosefrei",
    name: "Laktosefreie Kost",
    shortName: "LF",
    category: "allergen",
    description: "Kost ohne Laktose bei Laktoseintoleranz",
    nutrientTargets: [
      { nutrientId: "energie", target: 2000, min: 1800, max: 2200 },
      { nutrientId: "calcium", target: 1000, min: 800 },
    ],
    allergenExclusions: ["Milch"],
    isActive: true,
  },
  {
    id: "diet_pueriert",
    name: "Pürierte Kost",
    shortName: "PK",
    category: "consistency",
    description: "Pürierte Kost bei Kau- und Schluckstörungen",
    nutrientTargets: [
      { nutrientId: "energie", target: 1800, min: 1600, max: 2000 },
      { nutrientId: "eiweiss", target: 60, min: 50, max: 75 },
    ],
    allergenExclusions: [],
    isActive: true,
  },
  {
    id: "diet_fluessig",
    name: "Flüssigkost",
    shortName: "FK",
    category: "consistency",
    description: "Ausschließlich flüssige Nahrung, prä-/postoperativ",
    nutrientTargets: [
      { nutrientId: "energie", target: 1500, min: 1200, max: 1800 },
      { nutrientId: "eiweiss", target: 50, min: 40, max: 65 },
    ],
    allergenExclusions: [],
    isActive: false,
  },
];

// ──────────────────────────────────────────────
// Institution menu (1-week sample)
// ──────────────────────────────────────────────

export const INSTITUTION_MENUS: InstitutionMenu[] = [
  {
    id: "menu_kw15",
    name: "Menüplan KW 15/2026",
    cycleLength: 1,
    startDate: "2026-04-06",
    dietFormIds: ["diet_vollkost", "diet_diabetes", "diet_leichte_vollkost"],
    status: "active",
    ...ts,
    weeks: [
      {
        weekNumber: 1,
        days: [
          {
            dayOfWeek: 0,
            dietMenus: [
              {
                dietFormId: "diet_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 45 },
                  { type: "mittagessen", recipeId: "recipe_kartoffelsuppe", portionCount: 45 },
                  { type: "abendessen", recipeId: "recipe_vollkornbrot_quark", portionCount: 45 },
                ],
              },
              {
                dietFormId: "diet_diabetes",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_vollkornbrot_quark", portionCount: 12 },
                  { type: "mittagessen", recipeId: "recipe_haehnchen_salat", portionCount: 12 },
                  { type: "abendessen", recipeId: "recipe_linseneintopf", portionCount: 12 },
                ],
              },
              {
                dietFormId: "diet_leichte_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 20 },
                  { type: "mittagessen", recipeId: "recipe_kartoffelsuppe", portionCount: 20 },
                  { type: "abendessen", recipeId: "recipe_vollkornbrot_quark", portionCount: 20 },
                ],
              },
            ],
          },
          {
            dayOfWeek: 1,
            dietMenus: [
              {
                dietFormId: "diet_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_vollkornbrot_quark", portionCount: 45 },
                  { type: "mittagessen", recipeId: "recipe_gemuese_reis", portionCount: 45 },
                  { type: "abendessen", recipeId: "recipe_kartoffelsuppe", portionCount: 45 },
                ],
              },
              {
                dietFormId: "diet_diabetes",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 12 },
                  { type: "mittagessen", recipeId: "recipe_lachs_brokkoli", portionCount: 12 },
                  { type: "abendessen", recipeId: "recipe_haehnchen_salat", portionCount: 12 },
                ],
              },
              {
                dietFormId: "diet_leichte_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 20 },
                  { type: "mittagessen", recipeId: "recipe_kartoffelsuppe", portionCount: 20 },
                  { type: "abendessen", recipeId: "recipe_vollkornbrot_quark", portionCount: 20 },
                ],
              },
            ],
          },
          {
            dayOfWeek: 2,
            dietMenus: [
              {
                dietFormId: "diet_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 45 },
                  { type: "mittagessen", recipeId: "recipe_lachs_brokkoli", portionCount: 45 },
                  { type: "abendessen", recipeId: "recipe_linseneintopf", portionCount: 45 },
                ],
              },
              {
                dietFormId: "diet_diabetes",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_vollkornbrot_quark", portionCount: 12 },
                  { type: "mittagessen", recipeId: "recipe_gemuese_reis", portionCount: 12 },
                  { type: "abendessen", recipeId: "recipe_lachs_brokkoli", portionCount: 12 },
                ],
              },
              {
                dietFormId: "diet_leichte_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_vollkornbrot_quark", portionCount: 20 },
                  { type: "mittagessen", recipeId: "recipe_linseneintopf", portionCount: 20 },
                  { type: "abendessen", recipeId: "recipe_kartoffelsuppe", portionCount: 20 },
                ],
              },
            ],
          },
          {
            dayOfWeek: 3,
            dietMenus: [
              {
                dietFormId: "diet_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_vollkornbrot_quark", portionCount: 45 },
                  { type: "mittagessen", recipeId: "recipe_pasta_tomate", portionCount: 45 },
                  { type: "abendessen", recipeId: "recipe_haehnchen_salat", portionCount: 45 },
                ],
              },
              {
                dietFormId: "diet_diabetes",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 12 },
                  { type: "mittagessen", recipeId: "recipe_linseneintopf", portionCount: 12 },
                  { type: "abendessen", recipeId: "recipe_vollkornbrot_quark", portionCount: 12 },
                ],
              },
              {
                dietFormId: "diet_leichte_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 20 },
                  { type: "mittagessen", recipeId: "recipe_kartoffelsuppe", portionCount: 20 },
                  { type: "abendessen", recipeId: "recipe_linseneintopf", portionCount: 20 },
                ],
              },
            ],
          },
          {
            dayOfWeek: 4,
            dietMenus: [
              {
                dietFormId: "diet_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 45 },
                  { type: "mittagessen", recipeId: "recipe_haehnchen_salat", portionCount: 45 },
                  { type: "abendessen", recipeId: "recipe_gemuese_reis", portionCount: 45 },
                ],
              },
              {
                dietFormId: "diet_diabetes",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_vollkornbrot_quark", portionCount: 12 },
                  { type: "mittagessen", recipeId: "recipe_lachs_brokkoli", portionCount: 12 },
                  { type: "abendessen", recipeId: "recipe_linseneintopf", portionCount: 12 },
                ],
              },
              {
                dietFormId: "diet_leichte_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_vollkornbrot_quark", portionCount: 20 },
                  { type: "mittagessen", recipeId: "recipe_lachs_brokkoli", portionCount: 20 },
                  { type: "abendessen", recipeId: "recipe_haferbrei", portionCount: 20 },
                ],
              },
            ],
          },
          {
            dayOfWeek: 5,
            dietMenus: [
              {
                dietFormId: "diet_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_vollkornbrot_quark", portionCount: 45 },
                  { type: "mittagessen", recipeId: "recipe_linseneintopf", portionCount: 45 },
                  { type: "abendessen", recipeId: "recipe_pasta_tomate", portionCount: 45 },
                ],
              },
              {
                dietFormId: "diet_diabetes",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 12 },
                  { type: "mittagessen", recipeId: "recipe_haehnchen_salat", portionCount: 12 },
                  { type: "abendessen", recipeId: "recipe_gemuese_reis", portionCount: 12 },
                ],
              },
              {
                dietFormId: "diet_leichte_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 20 },
                  { type: "mittagessen", recipeId: "recipe_kartoffelsuppe", portionCount: 20 },
                  { type: "abendessen", recipeId: "recipe_vollkornbrot_quark", portionCount: 20 },
                ],
              },
            ],
          },
          {
            dayOfWeek: 6,
            dietMenus: [
              {
                dietFormId: "diet_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 45 },
                  { type: "mittagessen", recipeId: "recipe_lachs_brokkoli", portionCount: 45 },
                  { type: "abendessen", recipeId: "recipe_kartoffelsuppe", portionCount: 45 },
                ],
              },
              {
                dietFormId: "diet_diabetes",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_vollkornbrot_quark", portionCount: 12 },
                  { type: "mittagessen", recipeId: "recipe_linseneintopf", portionCount: 12 },
                  { type: "abendessen", recipeId: "recipe_haehnchen_salat", portionCount: 12 },
                ],
              },
              {
                dietFormId: "diet_leichte_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_vollkornbrot_quark", portionCount: 20 },
                  { type: "mittagessen", recipeId: "recipe_gemuese_reis", portionCount: 20 },
                  { type: "abendessen", recipeId: "recipe_linseneintopf", portionCount: 20 },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "menu_cycle_q2",
    name: "4-Wochen-Zyklus Q2/2026",
    cycleLength: 4,
    startDate: "2026-04-06",
    dietFormIds: ["diet_vollkost", "diet_diabetes", "diet_leichte_vollkost", "diet_nieren"],
    status: "draft",
    ...ts,
    weeks: [
      {
        weekNumber: 1,
        days: [
          {
            dayOfWeek: 0,
            dietMenus: [
              {
                dietFormId: "diet_vollkost",
                slots: [
                  { type: "fruehstueck", recipeId: "recipe_haferbrei", portionCount: 50 },
                  { type: "mittagessen", recipeId: "recipe_gemuese_reis", portionCount: 50 },
                  { type: "abendessen", recipeId: "recipe_kartoffelsuppe", portionCount: 50 },
                ],
              },
            ],
          },
        ],
      },
      { weekNumber: 2, days: [] },
      { weekNumber: 3, days: [] },
      { weekNumber: 4, days: [] },
    ],
  },
];

// ──────────────────────────────────────────────
// Hospital beds
// ──────────────────────────────────────────────

export const HOSPITAL_BEDS: HospitalBed[] = [
  { id: "bed_101a", room: "101", bed: "A", station: "Station 1", patientName: "Schmidt, Hans", patientId: "patient_hosp_1", dietFormIds: ["diet_vollkost"], allergens: [], admissionDate: "2026-04-01", status: "occupied" },
  { id: "bed_101b", room: "101", bed: "B", station: "Station 1", patientName: "Meier, Ingrid", patientId: "patient_hosp_2", dietFormIds: ["diet_diabetes"], allergens: [], admissionDate: "2026-04-03", status: "occupied" },
  { id: "bed_102a", room: "102", bed: "A", station: "Station 1", patientName: "Braun, Peter", patientId: "patient_hosp_3", dietFormIds: ["diet_nieren"], allergens: ["Milch"], admissionDate: "2026-03-28", status: "occupied" },
  { id: "bed_102b", room: "102", bed: "B", station: "Station 1", status: "empty", dietFormIds: [], allergens: [] },
  { id: "bed_103a", room: "103", bed: "A", station: "Station 1", patientName: "Koch, Ursula", patientId: "patient_hosp_4", dietFormIds: ["diet_leichte_vollkost"], allergens: ["Gluten"], admissionDate: "2026-04-05", status: "occupied" },
  { id: "bed_103b", room: "103", bed: "B", station: "Station 1", patientName: "Wolf, Dieter", patientId: "patient_hosp_5", dietFormIds: ["diet_vollkost", "diet_laktosefrei"], allergens: ["Milch"], admissionDate: "2026-04-07", status: "occupied" },
  { id: "bed_201a", room: "201", bed: "A", station: "Station 2", patientName: "Richter, Helga", patientId: "patient_hosp_6", dietFormIds: ["diet_pueriert"], allergens: [], admissionDate: "2026-03-20", status: "occupied" },
  { id: "bed_201b", room: "201", bed: "B", station: "Station 2", status: "reserved", dietFormIds: [], allergens: [], notes: "Reserviert ab 12.04." },
  { id: "bed_202a", room: "202", bed: "A", station: "Station 2", patientName: "Hartmann, Werner", patientId: "patient_hosp_7", dietFormIds: ["diet_diabetes", "diet_nieren"], allergens: [], admissionDate: "2026-04-02", status: "occupied" },
  { id: "bed_202b", room: "202", bed: "B", station: "Station 2", patientName: "Krause, Monika", patientId: "patient_hosp_8", dietFormIds: ["diet_vollkost"], allergens: ["Nüsse", "Sellerie"], admissionDate: "2026-04-08", status: "occupied" },
  { id: "bed_203a", room: "203", bed: "A", station: "Station 2", status: "empty", dietFormIds: [], allergens: [] },
  { id: "bed_203b", room: "203", bed: "B", station: "Station 2", patientName: "Lange, Friedrich", patientId: "patient_hosp_9", dietFormIds: ["diet_leichte_vollkost"], allergens: [], admissionDate: "2026-04-06", status: "occupied" },
];

// ──────────────────────────────────────────────
// Dietary orders
// ──────────────────────────────────────────────

export const DIETARY_ORDERS: DietaryOrder[] = [
  { id: "order_1", bedId: "bed_101a", room: "101", bed: "A", patientName: "Schmidt, Hans", dietFormIds: ["diet_vollkost"], mealSlot: "fruehstueck", date: "2026-04-10", status: "delivered", ...ts },
  { id: "order_2", bedId: "bed_101a", room: "101", bed: "A", patientName: "Schmidt, Hans", dietFormIds: ["diet_vollkost"], mealSlot: "mittagessen", date: "2026-04-10", status: "confirmed", ...ts },
  { id: "order_3", bedId: "bed_101a", room: "101", bed: "A", patientName: "Schmidt, Hans", dietFormIds: ["diet_vollkost"], mealSlot: "abendessen", date: "2026-04-10", status: "pending", ...ts },
  { id: "order_4", bedId: "bed_101b", room: "101", bed: "B", patientName: "Meier, Ingrid", dietFormIds: ["diet_diabetes"], mealSlot: "fruehstueck", date: "2026-04-10", status: "delivered", ...ts },
  { id: "order_5", bedId: "bed_101b", room: "101", bed: "B", patientName: "Meier, Ingrid", dietFormIds: ["diet_diabetes"], mealSlot: "mittagessen", date: "2026-04-10", status: "confirmed", ...ts },
  { id: "order_6", bedId: "bed_101b", room: "101", bed: "B", patientName: "Meier, Ingrid", dietFormIds: ["diet_diabetes"], mealSlot: "abendessen", date: "2026-04-10", status: "pending", ...ts },
  { id: "order_7", bedId: "bed_102a", room: "102", bed: "A", patientName: "Braun, Peter", dietFormIds: ["diet_nieren"], mealSlot: "fruehstueck", date: "2026-04-10", status: "delivered", ...ts },
  { id: "order_8", bedId: "bed_102a", room: "102", bed: "A", patientName: "Braun, Peter", dietFormIds: ["diet_nieren"], mealSlot: "mittagessen", date: "2026-04-10", status: "pending", specialInstructions: "Kaliumarm, keine Bananen", ...ts },
  { id: "order_9", bedId: "bed_103a", room: "103", bed: "A", patientName: "Koch, Ursula", dietFormIds: ["diet_leichte_vollkost"], mealSlot: "fruehstueck", date: "2026-04-10", status: "delivered", ...ts },
  { id: "order_10", bedId: "bed_103a", room: "103", bed: "A", patientName: "Koch, Ursula", dietFormIds: ["diet_leichte_vollkost"], mealSlot: "mittagessen", date: "2026-04-10", status: "confirmed", specialInstructions: "Glutenfrei", ...ts },
  { id: "order_11", bedId: "bed_103b", room: "103", bed: "B", patientName: "Wolf, Dieter", dietFormIds: ["diet_vollkost", "diet_laktosefrei"], mealSlot: "mittagessen", date: "2026-04-10", status: "pending", specialInstructions: "Laktosefrei", ...ts },
  { id: "order_12", bedId: "bed_201a", room: "201", bed: "A", patientName: "Richter, Helga", dietFormIds: ["diet_pueriert"], mealSlot: "mittagessen", date: "2026-04-10", status: "pending", specialInstructions: "Alle Speisen püriert", ...ts },
  { id: "order_13", bedId: "bed_202a", room: "202", bed: "A", patientName: "Hartmann, Werner", dietFormIds: ["diet_diabetes", "diet_nieren"], mealSlot: "mittagessen", date: "2026-04-10", status: "confirmed", specialInstructions: "Kalium- und zuckerkontrolliert", ...ts },
  { id: "order_14", bedId: "bed_202b", room: "202", bed: "B", patientName: "Krause, Monika", dietFormIds: ["diet_vollkost"], mealSlot: "mittagessen", date: "2026-04-10", status: "pending", specialInstructions: "Keine Nüsse, kein Sellerie", ...ts },
];

export const INPATIENT_STAYS: InpatientStay[] = [
  {
    id: "stay_patient_1",
    patientId: "patient_1",
    station: "Station 1",
    room: "101",
    bed: "A",
    status: "active",
    admissionDate: "2026-04-18",
    dietFormIds: ["diet_vollkost"],
    notes: "Normalkost, mobil.",
    ...ts,
  },
  {
    id: "stay_patient_2",
    patientId: "patient_2",
    station: "Station 1",
    room: "101",
    bed: "B",
    status: "active",
    admissionDate: "2026-04-19",
    dietFormIds: ["diet_diabetes"],
    ...ts,
  },
  {
    id: "stay_patient_3",
    patientId: "patient_3",
    station: "Station 1",
    room: "102",
    bed: "A",
    status: "active",
    admissionDate: "2026-04-20",
    dietFormIds: ["diet_glutenfrei"],
    notes: "Glutenfreie Versorgung erforderlich.",
    ...ts,
  },
  {
    id: "stay_patient_4",
    patientId: "patient_4",
    station: "Station 2",
    room: "201",
    bed: "A",
    status: "active",
    admissionDate: "2026-04-21",
    dietFormIds: ["diet_leichte_vollkost"],
    ...ts,
  },
  {
    id: "stay_patient_5",
    patientId: "patient_5",
    station: "Station 2",
    room: "202",
    bed: "B",
    status: "active",
    admissionDate: "2026-04-21",
    dietFormIds: ["diet_vollkost"],
    notes: "Mehrere Allergien, bitte Prüfung vor Ausgabe.",
    ...ts,
  },
  {
    id: "stay_patient_6",
    patientId: "patient_6",
    station: "Station 2",
    room: "203",
    bed: "A",
    status: "active",
    admissionDate: "2026-04-21",
    dietFormIds: ["diet_diabetes", "diet_nieren"],
    notes: "Schnittmenge aus Diabetes- und Nierenkost beachten.",
    ...ts,
  },
];

export const MEAL_ORDERS: MealOrder[] = [
  {
    id: "meal_order_patient_1_midday",
    inpatientStayId: "stay_patient_1",
    patientId: "patient_1",
    patientName: "Maria Schneider",
    station: "Station 1",
    room: "101",
    bed: "A",
    date: "2026-04-21",
    mealSlot: "mittagessen",
    recipeId: "recipe_lachs_brokkoli",
    recipeName: "Lachs mit Brokkoli",
    dietFormIdsSnapshot: ["diet_vollkost"],
    allergenIdsSnapshot: [],
    restrictionSummary: ["Vollkost"],
    status: "confirmed",
    ...ts,
  },
  {
    id: "meal_order_patient_2_midday",
    inpatientStayId: "stay_patient_2",
    patientId: "patient_2",
    patientName: "Thomas Weber",
    station: "Station 1",
    room: "101",
    bed: "B",
    date: "2026-04-21",
    mealSlot: "mittagessen",
    recipeId: "recipe_gemuese_reis",
    recipeName: "Gemüsepfanne mit Reis",
    dietFormIdsSnapshot: ["diet_diabetes"],
    allergenIdsSnapshot: [],
    restrictionSummary: ["Diabeteskost"],
    status: "pending",
    ...ts,
  },
];

// ──────────────────────────────────────────────
// Production lists
// ──────────────────────────────────────────────

export const PRODUCTION_LISTS: ProductionList[] = [
  {
    id: "prod_20260410",
    menuId: "menu_kw15",
    date: "2026-04-10",
    station: "Hauptküche",
    ...ts,
    items: [
      {
        recipeId: "recipe_kartoffelsuppe",
        recipeName: "Kartoffelsuppe",
        dietFormId: "diet_vollkost",
        mealSlot: "mittagessen",
        portionCount: 45,
        ingredients: [
          { foodId: "food_kartoffel", foodName: "Kartoffel", totalAmount: 6750, unit: "g" },
          { foodId: "food_zwiebel", foodName: "Zwiebel", totalAmount: 1125, unit: "g" },
          { foodId: "food_karotte", foodName: "Karotte", totalAmount: 1688, unit: "g" },
          { foodId: "food_vollmilch", foodName: "Vollmilch", totalAmount: 2250, unit: "ml" },
          { foodId: "food_butter", foodName: "Butter", totalAmount: 225, unit: "g" },
          { foodId: "food_petersilie", foodName: "Petersilie", totalAmount: 113, unit: "g" },
        ],
      },
      {
        recipeId: "recipe_haferbrei",
        recipeName: "Haferbrei mit Beeren",
        dietFormId: "diet_vollkost",
        mealSlot: "fruehstueck",
        portionCount: 45,
        ingredients: [
          { foodId: "food_haferflocken", foodName: "Haferflocken", totalAmount: 2700, unit: "g" },
          { foodId: "food_vollmilch", foodName: "Vollmilch", totalAmount: 9000, unit: "ml" },
          { foodId: "food_heidelbeere", foodName: "Heidelbeeren", totalAmount: 2250, unit: "g" },
          { foodId: "food_erdbeere", foodName: "Erdbeeren", totalAmount: 2250, unit: "g" },
          { foodId: "food_honig", foodName: "Honig", totalAmount: 675, unit: "g" },
          { foodId: "food_banane", foodName: "Banane", totalAmount: 2250, unit: "g" },
        ],
      },
      {
        recipeId: "recipe_haehnchen_salat",
        recipeName: "Hähnchen-Salat",
        dietFormId: "diet_diabetes",
        mealSlot: "mittagessen",
        portionCount: 12,
        ingredients: [
          { foodId: "food_haehnchenbrust", foodName: "Hähnchenbrust", totalAmount: 1500, unit: "g" },
          { foodId: "food_tomate", foodName: "Tomate", totalAmount: 900, unit: "g" },
          { foodId: "food_gurke", foodName: "Gurke", totalAmount: 900, unit: "g" },
          { foodId: "food_paprika", foodName: "Paprika", totalAmount: 600, unit: "g" },
          { foodId: "food_olivenoel", foodName: "Olivenöl", totalAmount: 120, unit: "ml" },
          { foodId: "food_spinat", foodName: "Spinat", totalAmount: 480, unit: "g" },
        ],
      },
      {
        recipeId: "recipe_linseneintopf",
        recipeName: "Linseneintopf",
        dietFormId: "diet_diabetes",
        mealSlot: "abendessen",
        portionCount: 12,
        ingredients: [
          { foodId: "food_rote_linsen", foodName: "Rote Linsen", totalAmount: 1200, unit: "g" },
          { foodId: "food_karotte", foodName: "Karotte", totalAmount: 600, unit: "g" },
          { foodId: "food_kartoffel", foodName: "Kartoffel", totalAmount: 900, unit: "g" },
          { foodId: "food_zwiebel", foodName: "Zwiebel", totalAmount: 300, unit: "g" },
          { foodId: "food_olivenoel", foodName: "Olivenöl", totalAmount: 45, unit: "ml" },
          { foodId: "food_tomate", foodName: "Tomate", totalAmount: 600, unit: "g" },
        ],
      },
    ],
  },
];

// ──────────────────────────────────────────────
// Shopping lists
// ──────────────────────────────────────────────

export const SHOPPING_LISTS: ShoppingList[] = [
  {
    id: "shop_kw15",
    menuId: "menu_kw15",
    weekNumber: 15,
    dateRange: { start: "2026-04-06", end: "2026-04-12" },
    totalCost: 2847.50,
    ...ts,
    items: [
      { foodId: "food_kartoffel", foodName: "Kartoffel", categoryId: "cat_gemuese", categoryName: "Gemüse", totalAmount: 47250, unit: "kg", estimatedCost: 189.00 },
      { foodId: "food_karotte", foodName: "Karotte", categoryId: "cat_gemuese", categoryName: "Gemüse", totalAmount: 16100, unit: "kg", estimatedCost: 80.50 },
      { foodId: "food_zwiebel", foodName: "Zwiebel", categoryId: "cat_gemuese", categoryName: "Gemüse", totalAmount: 9800, unit: "kg", estimatedCost: 39.20 },
      { foodId: "food_tomate", foodName: "Tomate", categoryId: "cat_gemuese", categoryName: "Gemüse", totalAmount: 12600, unit: "kg", estimatedCost: 100.80 },
      { foodId: "food_brokkoli", foodName: "Brokkoli", categoryId: "cat_gemuese", categoryName: "Gemüse", totalAmount: 8400, unit: "kg", estimatedCost: 117.60 },
      { foodId: "food_paprika", foodName: "Paprika", categoryId: "cat_gemuese", categoryName: "Gemüse", totalAmount: 5600, unit: "kg", estimatedCost: 67.20 },
      { foodId: "food_spinat", foodName: "Spinat", categoryId: "cat_gemuese", categoryName: "Gemüse", totalAmount: 3360, unit: "kg", estimatedCost: 53.76 },
      { foodId: "food_gurke", foodName: "Gurke", categoryId: "cat_gemuese", categoryName: "Gemüse", totalAmount: 4200, unit: "kg", estimatedCost: 33.60 },
      { foodId: "food_zucchini", foodName: "Zucchini", categoryId: "cat_gemuese", categoryName: "Gemüse", totalAmount: 4200, unit: "kg", estimatedCost: 42.00 },
      { foodId: "food_haehnchenbrust", foodName: "Hähnchenbrust", categoryId: "cat_fleisch", categoryName: "Fleisch", totalAmount: 10500, unit: "kg", estimatedCost: 315.00 },
      { foodId: "food_lachs", foodName: "Lachs", categoryId: "cat_fisch", categoryName: "Fisch", totalAmount: 6300, unit: "kg", estimatedCost: 441.00 },
      { foodId: "food_vollmilch", foodName: "Vollmilch", categoryId: "cat_milch", categoryName: "Milchprodukte", totalAmount: 56000, unit: "l", estimatedCost: 168.00 },
      { foodId: "food_magerquark", foodName: "Magerquark", categoryId: "cat_milch", categoryName: "Milchprodukte", totalAmount: 5600, unit: "kg", estimatedCost: 50.40 },
      { foodId: "food_haferflocken", foodName: "Haferflocken", categoryId: "cat_getreide", categoryName: "Getreide", totalAmount: 12600, unit: "kg", estimatedCost: 37.80 },
      { foodId: "food_vollkornbrot", foodName: "Vollkornbrot", categoryId: "cat_getreide", categoryName: "Getreide", totalAmount: 14000, unit: "kg", estimatedCost: 112.00 },
      { foodId: "food_reis", foodName: "Reis", categoryId: "cat_getreide", categoryName: "Getreide", totalAmount: 6300, unit: "kg", estimatedCost: 31.50 },
      { foodId: "food_nudeln", foodName: "Nudeln", categoryId: "cat_getreide", categoryName: "Getreide", totalAmount: 8400, unit: "kg", estimatedCost: 33.60 },
      { foodId: "food_rote_linsen", foodName: "Rote Linsen", categoryId: "cat_huelsenfruechte", categoryName: "Hülsenfrüchte", totalAmount: 8400, unit: "kg", estimatedCost: 58.80 },
      { foodId: "food_olivenoel", foodName: "Olivenöl", categoryId: "cat_oele", categoryName: "Öle & Fette", totalAmount: 2100, unit: "l", estimatedCost: 126.00 },
      { foodId: "food_butter", foodName: "Butter", categoryId: "cat_oele", categoryName: "Öle & Fette", totalAmount: 3150, unit: "kg", estimatedCost: 94.50 },
      { foodId: "food_heidelbeere", foodName: "Heidelbeeren", categoryId: "cat_obst", categoryName: "Obst", totalAmount: 10500, unit: "kg", estimatedCost: 210.00 },
      { foodId: "food_erdbeere", foodName: "Erdbeeren", categoryId: "cat_obst", categoryName: "Obst", totalAmount: 10500, unit: "kg", estimatedCost: 189.00 },
      { foodId: "food_banane", foodName: "Banane", categoryId: "cat_obst", categoryName: "Obst", totalAmount: 10500, unit: "kg", estimatedCost: 105.00 },
      { foodId: "food_honig", foodName: "Honig", categoryId: "cat_snacks", categoryName: "Snacks", totalAmount: 3150, unit: "kg", estimatedCost: 94.50 },
      { foodId: "food_gouda", foodName: "Gouda", categoryId: "cat_milch", categoryName: "Milchprodukte", totalAmount: 1680, unit: "kg", estimatedCost: 33.60 },
    ],
  },
];

// ──────────────────────────────────────────────
// Compliance data
// ──────────────────────────────────────────────

export const COMPLIANCE_DATA: DayCompliance[] = [
  {
    date: "2026-04-07", dietFormId: "diet_vollkost", overallScore: 87,
    results: [
      { nutrientId: "energie", nutrientName: "Energie", unit: "kcal", actual: 1950, target: 2000, min: 1800, max: 2200, percentage: 97.5, status: "ok" },
      { nutrientId: "eiweiss", nutrientName: "Eiweiß", unit: "g", actual: 62, target: 60, min: 50, max: 80, percentage: 103.3, status: "ok" },
      { nutrientId: "fett", nutrientName: "Fett", unit: "g", actual: 68, target: 65, min: 55, max: 80, percentage: 104.6, status: "ok" },
      { nutrientId: "kohlenhydrate", nutrientName: "Kohlenhydrate", unit: "g", actual: 245, target: 250, min: 220, max: 300, percentage: 98.0, status: "ok" },
      { nutrientId: "ballaststoffe", nutrientName: "Ballaststoffe", unit: "g", actual: 22, target: 30, min: 25, percentage: 73.3, status: "warning" },
      { nutrientId: "natrium", nutrientName: "Natrium", unit: "mg", actual: 1850, target: 2300, max: 2300, percentage: 80.4, status: "ok" },
    ],
  },
  {
    date: "2026-04-07", dietFormId: "diet_diabetes", overallScore: 92,
    results: [
      { nutrientId: "energie", nutrientName: "Energie", unit: "kcal", actual: 1780, target: 1800, min: 1600, max: 2000, percentage: 98.9, status: "ok" },
      { nutrientId: "eiweiss", nutrientName: "Eiweiß", unit: "g", actual: 72, target: 70, min: 60, max: 90, percentage: 102.9, status: "ok" },
      { nutrientId: "kohlenhydrate", nutrientName: "Kohlenhydrate", unit: "g", actual: 195, target: 200, min: 170, max: 230, percentage: 97.5, status: "ok" },
      { nutrientId: "zucker", nutrientName: "Zucker", unit: "g", actual: 28, target: 30, max: 30, percentage: 93.3, status: "ok" },
      { nutrientId: "ballaststoffe", nutrientName: "Ballaststoffe", unit: "g", actual: 33, target: 35, min: 30, percentage: 94.3, status: "ok" },
    ],
  },
  {
    date: "2026-04-08", dietFormId: "diet_vollkost", overallScore: 78,
    results: [
      { nutrientId: "energie", nutrientName: "Energie", unit: "kcal", actual: 2150, target: 2000, min: 1800, max: 2200, percentage: 107.5, status: "ok" },
      { nutrientId: "eiweiss", nutrientName: "Eiweiß", unit: "g", actual: 55, target: 60, min: 50, max: 80, percentage: 91.7, status: "ok" },
      { nutrientId: "fett", nutrientName: "Fett", unit: "g", actual: 82, target: 65, min: 55, max: 80, percentage: 126.2, status: "warning" },
      { nutrientId: "kohlenhydrate", nutrientName: "Kohlenhydrate", unit: "g", actual: 260, target: 250, min: 220, max: 300, percentage: 104.0, status: "ok" },
      { nutrientId: "ballaststoffe", nutrientName: "Ballaststoffe", unit: "g", actual: 18, target: 30, min: 25, percentage: 60.0, status: "critical" },
      { nutrientId: "natrium", nutrientName: "Natrium", unit: "mg", actual: 2450, target: 2300, max: 2300, percentage: 106.5, status: "warning" },
    ],
  },
  {
    date: "2026-04-08", dietFormId: "diet_diabetes", overallScore: 85,
    results: [
      { nutrientId: "energie", nutrientName: "Energie", unit: "kcal", actual: 1820, target: 1800, min: 1600, max: 2000, percentage: 101.1, status: "ok" },
      { nutrientId: "eiweiss", nutrientName: "Eiweiß", unit: "g", actual: 68, target: 70, min: 60, max: 90, percentage: 97.1, status: "ok" },
      { nutrientId: "kohlenhydrate", nutrientName: "Kohlenhydrate", unit: "g", actual: 210, target: 200, min: 170, max: 230, percentage: 105.0, status: "ok" },
      { nutrientId: "zucker", nutrientName: "Zucker", unit: "g", actual: 32, target: 30, max: 30, percentage: 106.7, status: "warning" },
      { nutrientId: "ballaststoffe", nutrientName: "Ballaststoffe", unit: "g", actual: 31, target: 35, min: 30, percentage: 88.6, status: "ok" },
    ],
  },
  {
    date: "2026-04-09", dietFormId: "diet_vollkost", overallScore: 91,
    results: [
      { nutrientId: "energie", nutrientName: "Energie", unit: "kcal", actual: 2010, target: 2000, min: 1800, max: 2200, percentage: 100.5, status: "ok" },
      { nutrientId: "eiweiss", nutrientName: "Eiweiß", unit: "g", actual: 64, target: 60, min: 50, max: 80, percentage: 106.7, status: "ok" },
      { nutrientId: "fett", nutrientName: "Fett", unit: "g", actual: 63, target: 65, min: 55, max: 80, percentage: 96.9, status: "ok" },
      { nutrientId: "kohlenhydrate", nutrientName: "Kohlenhydrate", unit: "g", actual: 248, target: 250, min: 220, max: 300, percentage: 99.2, status: "ok" },
      { nutrientId: "ballaststoffe", nutrientName: "Ballaststoffe", unit: "g", actual: 28, target: 30, min: 25, percentage: 93.3, status: "ok" },
      { nutrientId: "natrium", nutrientName: "Natrium", unit: "mg", actual: 2100, target: 2300, max: 2300, percentage: 91.3, status: "ok" },
    ],
  },
  {
    date: "2026-04-09", dietFormId: "diet_diabetes", overallScore: 95,
    results: [
      { nutrientId: "energie", nutrientName: "Energie", unit: "kcal", actual: 1790, target: 1800, min: 1600, max: 2000, percentage: 99.4, status: "ok" },
      { nutrientId: "eiweiss", nutrientName: "Eiweiß", unit: "g", actual: 74, target: 70, min: 60, max: 90, percentage: 105.7, status: "ok" },
      { nutrientId: "kohlenhydrate", nutrientName: "Kohlenhydrate", unit: "g", actual: 190, target: 200, min: 170, max: 230, percentage: 95.0, status: "ok" },
      { nutrientId: "zucker", nutrientName: "Zucker", unit: "g", actual: 24, target: 30, max: 30, percentage: 80.0, status: "ok" },
      { nutrientId: "ballaststoffe", nutrientName: "Ballaststoffe", unit: "g", actual: 36, target: 35, min: 30, percentage: 102.9, status: "ok" },
    ],
  },
];

// ──────────────────────────────────────────────
// Statistics
// ──────────────────────────────────────────────

export const DIET_FORM_COUNTS: DietFormCount[] = [
  { dietFormId: "diet_vollkost", dietFormName: "Vollkost", count: 45, percentage: 42.1 },
  { dietFormId: "diet_leichte_vollkost", dietFormName: "Leichte Vollkost", count: 20, percentage: 18.7 },
  { dietFormId: "diet_diabetes", dietFormName: "Diabeteskost", count: 15, percentage: 14.0 },
  { dietFormId: "diet_nieren", dietFormName: "Nierendiät", count: 8, percentage: 7.5 },
  { dietFormId: "diet_glutenfrei", dietFormName: "Glutenfreie Kost", count: 6, percentage: 5.6 },
  { dietFormId: "diet_laktosefrei", dietFormName: "Laktosefreie Kost", count: 5, percentage: 4.7 },
  { dietFormId: "diet_pueriert", dietFormName: "Pürierte Kost", count: 5, percentage: 4.7 },
  { dietFormId: "diet_fluessig", dietFormName: "Flüssigkost", count: 3, percentage: 2.8 },
];

export const MENU_CHOICE_STATS: MenuChoiceStat[] = [
  { recipeId: "recipe_kartoffelsuppe", recipeName: "Kartoffelsuppe", count: 312, rating: 4.2 },
  { recipeId: "recipe_haferbrei", recipeName: "Haferbrei mit Beeren", count: 287, rating: 4.5 },
  { recipeId: "recipe_linseneintopf", recipeName: "Linseneintopf", count: 265, rating: 3.9 },
  { recipeId: "recipe_haehnchen_salat", recipeName: "Hähnchen-Salat", count: 248, rating: 4.4 },
  { recipeId: "recipe_lachs_brokkoli", recipeName: "Lachs mit Brokkoli", count: 231, rating: 4.6 },
  { recipeId: "recipe_gemuese_reis", recipeName: "Gemüsepfanne mit Reis", count: 218, rating: 4.0 },
  { recipeId: "recipe_vollkornbrot_quark", recipeName: "Vollkornbrot mit Quark", count: 195, rating: 3.7 },
  { recipeId: "recipe_pasta_tomate", recipeName: "Pasta mit Tomatensauce", count: 178, rating: 4.3 },
];

export const COST_ANALYSIS: CostAnalysis[] = [
  { date: "2026-04-06", totalCost: 412.50, costPerPortion: 5.35, portionCount: 77 },
  { date: "2026-04-07", totalCost: 398.20, costPerPortion: 5.17, portionCount: 77 },
  { date: "2026-04-08", totalCost: 445.80, costPerPortion: 5.79, portionCount: 77 },
  { date: "2026-04-09", totalCost: 425.00, costPerPortion: 5.52, portionCount: 77 },
  { date: "2026-04-10", totalCost: 418.30, costPerPortion: 5.43, portionCount: 77 },
  { date: "2026-04-11", totalCost: 390.60, costPerPortion: 5.07, portionCount: 77 },
  { date: "2026-04-12", totalCost: 357.10, costPerPortion: 4.64, portionCount: 77 },
];

export const INSTITUTION_OVERVIEW_STATS: InstitutionOverviewStats = {
  totalBeds: 12,
  occupiedBeds: 9,
  occupancyRate: 75.0,
  activeDietForms: 7,
  averageCostPerDay: 406.79,
  averageCostPerPortion: 5.28,
  complianceRate: 88.0,
  pendingOrders: 6,
};

export const KITCHEN_STATIONS = [
  "Hauptküche",
  "Kalte Küche",
  "Diätküche",
  "Patisserie",
] as const;

export const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
export const DAY_LABELS_FULL = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"] as const;
