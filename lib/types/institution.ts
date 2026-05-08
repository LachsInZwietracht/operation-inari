import type { ID, Timestamped } from "./common";
import type { MealSlotType } from "./meal-plan";

// ──────────────────────────────────────────────
// Diet forms (Kostformen)
// ──────────────────────────────────────────────

export type DietFormCategory =
  | "standard"
  | "diabetes"
  | "renal"
  | "allergen"
  | "consistency"
  | "custom";

export interface NutrientTarget {
  nutrientId: ID;
  min?: number;
  max?: number;
  target?: number;
}

export interface DietForm {
  id: ID;
  name: string;
  shortName: string;
  category: DietFormCategory;
  description: string;
  nutrientTargets: NutrientTarget[];
  allergenExclusions: string[];
  isActive: boolean;
}

// ──────────────────────────────────────────────
// Institution menus (weekly / 4-week cycles)
// ──────────────────────────────────────────────

export type MenuCycleLength = 1 | 2 | 4;

export interface InstitutionMealSlot {
  type: MealSlotType;
  recipeId: ID;
  portionCount: number;
}

export interface DietDayMenu {
  dietFormId: ID;
  slots: InstitutionMealSlot[];
}

export interface InstitutionMenuDay {
  dayOfWeek: number; // 0=Mo … 6=So
  dietMenus: DietDayMenu[];
}

export interface MenuWeek {
  weekNumber: number;
  days: InstitutionMenuDay[];
}

export interface InstitutionMenu extends Timestamped {
  id: ID;
  name: string;
  cycleLength: MenuCycleLength;
  startDate: string;
  dietFormIds: ID[];
  weeks: MenuWeek[];
  status: "draft" | "active" | "archived";
}

// ──────────────────────────────────────────────
// Production & shopping lists
// ──────────────────────────────────────────────

export interface ProductionIngredient {
  foodId: ID;
  foodName: string;
  totalAmount: number; // grams
  unit: string;
}

export interface ProductionItem {
  recipeId: ID;
  recipeName: string;
  dietFormId: ID;
  mealSlot: MealSlotType;
  portionCount: number;
  ingredients: ProductionIngredient[];
}

export type ProductionBatchStatus = "planned" | "in_preparation" | "ready" | "served" | "held";

export interface KitchenProductionBatch extends Timestamped {
  id: ID;
  menuId: ID;
  weekNumber: number;
  dayOfWeek: number;
  serviceDate: string;
  mealSlot: MealSlotType;
  dietFormId: ID;
  recipeId: ID;
  recipeName: string;
  portionCount: number;
  status: ProductionBatchStatus;
}

export interface ProductionList extends Timestamped {
  id: ID;
  menuId: ID;
  date: string;
  station: string;
  items: ProductionItem[];
}

export interface ShoppingItem {
  foodId: ID;
  foodName: string;
  categoryId: ID;
  categoryName: string;
  totalAmount: number; // grams
  unit: string;
  estimatedCost: number; // EUR
}

export interface ShoppingList extends Timestamped {
  id: ID;
  menuId: ID;
  weekNumber: number;
  dateRange: { start: string; end: string };
  items: ShoppingItem[];
  totalCost: number;
}

// ──────────────────────────────────────────────
// Hospital management
// ──────────────────────────────────────────────

export type BedStatus = "occupied" | "empty" | "reserved";
export type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";

export interface HospitalBed {
  id: ID;
  room: string;
  bed: string;
  station: string;
  patientName?: string;
  patientId?: ID;
  dietFormIds: ID[];
  allergens: string[];
  notes?: string;
  admissionDate?: string;
  status: BedStatus;
}

export interface DietaryOrder extends Timestamped {
  id: ID;
  bedId: ID;
  room: string;
  bed: string;
  patientName: string;
  dietFormIds: ID[];
  mealSlot: MealSlotType;
  date: string;
  specialInstructions?: string;
  status: OrderStatus;
}

export type InpatientStayStatus = "active" | "discharged";

export interface InpatientStay extends Timestamped {
  id: ID;
  legacyId?: ID;
  patientId: ID;
  station: string;
  room: string;
  bed: string;
  status: InpatientStayStatus;
  admissionDate: string;
  dischargeDate?: string;
  dietFormIds: ID[];
  notes?: string;
}

export interface MealOrder extends Timestamped {
  id: ID;
  legacyId?: ID;
  inpatientStayId: ID;
  patientId: ID;
  patientName: string;
  station: string;
  room: string;
  bed: string;
  date: string;
  mealSlot: MealSlotType;
  recipeId: ID;
  recipeName: string;
  dietFormIdsSnapshot: ID[];
  allergenIdsSnapshot: string[];
  restrictionSummary: string[];
  specialInstructions?: string;
  status: OrderStatus;
}

export interface MealCandidate {
  recipeId: ID;
  recipeName: string;
  dietFormIds: ID[];
  blockedReasons: string[];
  isSelectable: boolean;
}

// ──────────────────────────────────────────────
// Nutritional compliance
// ──────────────────────────────────────────────

export interface ComplianceResult {
  nutrientId: ID;
  nutrientName: string;
  unit: string;
  actual: number;
  target: number;
  min?: number;
  max?: number;
  percentage: number;
  status: "ok" | "warning" | "critical";
}

export interface DayCompliance {
  date: string;
  dietFormId: ID;
  overallScore: number; // 0-100
  results: ComplianceResult[];
}

// ──────────────────────────────────────────────
// Institution statistics
// ──────────────────────────────────────────────

export interface DietFormCount {
  dietFormId: ID;
  dietFormName: string;
  count: number;
  percentage: number;
}

export interface MenuChoiceStat {
  recipeId: ID;
  recipeName: string;
  count: number;
  rating: number;
}

export interface CostAnalysis {
  date: string;
  totalCost: number;
  costPerPortion: number;
  portionCount: number;
}

export interface InstitutionOverviewStats {
  totalBeds: number;
  occupiedBeds: number;
  occupancyRate: number;
  activeDietForms: number;
  averageCostPerDay: number;
  averageCostPerPortion: number;
  complianceRate: number;
  pendingOrders: number;
}
