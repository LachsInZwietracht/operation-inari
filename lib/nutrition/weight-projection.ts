import {
  calculateBasalMetabolicRate,
  KCAL_PER_KG_WEIGHT_CHANGE,
  type EnergyFormula,
  type EnergySex,
} from "@/lib/nutrition/energy-calculation"

/**
 * Where a given daily calorie intake would take a patient's weight.
 *
 * The obvious model — deficit × days ÷ 7700 — is the one every calorie app
 * uses, and it is wrong in a way that matters here. It draws a straight line
 * downward forever, so a 500 kcal deficit "reaches" any goal weight given
 * enough weeks. Patients do not do that, and a dietitian who has watched a
 * hundred people stall at month four knows it.
 *
 * What actually happens is that energy expenditure falls with body weight: a
 * lighter body costs less to run. So this recomputes expenditure at the new
 * weight every simulated week. The curve flattens on its own and settles at the
 * weight where intake and expenditure meet — the plateau. That plateau is the
 * honest answer to "and then what?", and it is the number a counseling
 * conversation should start from.
 *
 * What this still does not model: adaptive thermogenesis beyond the weight
 * term, changes in body composition, and the fact that nobody eats the same
 * number every day. It is a projection to talk about, not a prediction.
 */

const MIN_WEIGHT_KG = 30
const MAX_WEIGHT_KG = 400
/** Below this the intake is close enough to maintenance to call it flat. */
const FLAT_WEEKLY_KG = 0.005
/**
 * Five years. Past that the projection has long stopped meaning anything, and
 * a goal that far out should read as unreachable rather than as a date.
 */
const MAX_SEARCH_WEEKS = 260

export interface WeightProjectionInput {
  /** Daily intake being considered, in kcal. */
  targetKcal: number
  weightKg: number
  heightCm: number
  ageYears: number
  sex: EnergySex
  formula: EnergyFormula
  pal: number
  goalWeightKg?: number
  /** How many weeks to simulate. */
  weeks?: number
}

export interface WeightProjectionPoint {
  week: number
  weightKg: number
}

export interface WeightProjection {
  points: WeightProjectionPoint[]
  /** Rate at today's weight — steepest the curve ever gets. */
  weeklyChangeKgNow: number
  /** Weight at which this intake becomes maintenance, or `null` if out of range. */
  plateauWeightKg: number | null
  /** Fractional weeks until the goal weight, or `null` if this intake never gets there. */
  weeksToGoal: number | null
}

function clampWeight(weightKg: number): number {
  return Math.min(MAX_WEIGHT_KG, Math.max(MIN_WEIGHT_KG, weightKg))
}

/** Total daily energy expenditure the patient would have at `weightKg`. */
function expenditureAt(weightKg: number, input: WeightProjectionInput): number {
  const basal = calculateBasalMetabolicRate(
    input.sex,
    input.formula,
    weightKg,
    input.heightCm,
    input.ageYears,
  )
  return Math.max(0, basal) * Math.max(0, input.pal)
}

/**
 * The weight where expenditure equals intake, found by bisection.
 *
 * Expenditure rises with weight in both supported formulas, so the difference
 * crosses zero exactly once. Bisection keeps this independent of which formula
 * is in use, rather than inverting each one by hand.
 */
function findPlateauWeight(input: WeightProjectionInput): number | null {
  const target = input.targetKcal
  if (expenditureAt(MIN_WEIGHT_KG, input) > target) return null
  if (expenditureAt(MAX_WEIGHT_KG, input) < target) return null

  let low = MIN_WEIGHT_KG
  let high = MAX_WEIGHT_KG
  for (let step = 0; step < 60; step += 1) {
    const mid = (low + high) / 2
    if (expenditureAt(mid, input) < target) low = mid
    else high = mid
  }
  return (low + high) / 2
}

export function projectWeight(input: WeightProjectionInput): WeightProjection {
  const weeks = Math.max(1, Math.round(input.weeks ?? 26))
  const start = clampWeight(input.weightKg)

  const weeklyChangeKgNow =
    ((input.targetKcal - expenditureAt(start, input)) * 7) / KCAL_PER_KG_WEIGHT_CHANGE

  // The chart only needs the near weeks, but the goal can sit well past them —
  // a 400 kcal deficit takes roughly nine months to shed 12 kg. Stopping the
  // search at the chart's horizon would report a reachable goal as impossible.
  const horizon = Math.max(weeks, MAX_SEARCH_WEEKS)
  const points: WeightProjectionPoint[] = [{ week: 0, weightKg: start }]
  let current = start
  let weeksToGoal: number | null = null

  for (let week = 1; week <= horizon; week += 1) {
    const change =
      ((input.targetKcal - expenditureAt(current, input)) * 7) / KCAL_PER_KG_WEIGHT_CHANGE
    const next = clampWeight(current + change)

    if (
      weeksToGoal === null &&
      input.goalWeightKg !== undefined &&
      crossesGoal(current, next, input.goalWeightKg)
    ) {
      // Interpolate inside the week so the date is not always a Monday.
      const span = next - current
      weeksToGoal = week - 1 + (span === 0 ? 0 : (input.goalWeightKg - current) / span)
    }

    current = next
    if (week <= weeks) points.push({ week, weightKg: current })
    if (weeksToGoal !== null && week >= weeks) break
  }

  return {
    points,
    weeklyChangeKgNow,
    plateauWeightKg: findPlateauWeight(input),
    weeksToGoal,
  }
}

function crossesGoal(from: number, to: number, goal: number): boolean {
  if (from === goal) return true
  return from < goal ? to >= goal : to <= goal
}

/** True when the intake is effectively maintenance, so no projection is worth showing. */
export function isMaintenanceIntake(projection: WeightProjection): boolean {
  return Math.abs(projection.weeklyChangeKgNow) < FLAT_WEEKLY_KG
}
