import { differenceInYears, parseISO } from "date-fns";
import { AGE_GROUPS, REFERENCE_STANDARDS } from "@/lib/mock-data/reference-standards";
import type {
  AgeGroup,
  CustomReferenceProfile,
  Gender,
  LifeStage,
  ReferenceNutrientValue,
  ReferenceStandard,
  ReferenceStandardId,
  ResolvedReferenceConfig,
} from "@/lib/types";

/**
 * Determines the matching age group for a given age in years.
 */
export function getAgeGroup(ageInYears: number): AgeGroup {
  const group = AGE_GROUPS.find(
    (g) => ageInYears >= g.minAge && ageInYears < g.maxAge,
  );
  // Fallback to the adult 25-51 bracket
  return group ?? AGE_GROUPS.find((g) => g.id === "25-51")!;
}

/**
 * Calculates the age from a date of birth string (ISO format).
 */
export function getAgeFromDateOfBirth(dateOfBirth: string): number {
  return differenceInYears(new Date(), parseISO(dateOfBirth));
}

/**
 * Gets a reference standard by ID.
 */
export function getReferenceStandard(
  standardId: ReferenceStandardId,
): ReferenceStandard | undefined {
  return REFERENCE_STANDARDS.find((s) => s.id === standardId);
}

/**
 * Resolves the nutrient reference values for a specific demographic context.
 * Looks up the correct bracket within a standard, applying life-stage
 * overrides when applicable.
 */
export function resolveReferenceValues(
  standardId: ReferenceStandardId,
  ageGroupId: string,
  gender: "m" | "w",
  lifeStage: LifeStage = "none",
): ReferenceNutrientValue[] {
  const standard = getReferenceStandard(standardId);
  if (!standard) return [];

  // If life stage is active, try to find a life-stage bracket first
  if (lifeStage !== "none") {
    const lsBracket = standard.brackets.find(
      (br) => br.lifeStage === lifeStage && br.gender === gender,
    );
    if (lsBracket) return lsBracket.values;
  }

  // Find the exact bracket
  const bracket = standard.brackets.find(
    (br) =>
      br.ageGroupId === ageGroupId &&
      br.gender === gender &&
      br.lifeStage === "none",
  );

  return bracket?.values ?? [];
}

/**
 * Resolves reference values for a custom profile, applying overrides
 * on top of the base standard's values.
 */
export function resolveCustomProfile(
  profile: CustomReferenceProfile,
): ReferenceNutrientValue[] {
  if (!profile.basedOn) return profile.overrides;

  const baseValues = resolveReferenceValues(
    profile.basedOn,
    profile.ageGroupId,
    profile.gender,
    profile.lifeStage,
  );

  if (profile.overrides.length === 0) return baseValues;

  // Merge: overrides take priority
  const overrideMap = new Map(
    profile.overrides.map((o) => [o.nutrientId, o.amount]),
  );

  return baseValues.map((v) => ({
    nutrientId: v.nutrientId,
    amount: overrideMap.get(v.nutrientId) ?? v.amount,
  }));
}

/**
 * Creates a complete resolved reference configuration for a patient.
 * This is the main entry point used by UI components.
 */
export function resolveReferenceForPatient(opts: {
  standardId: ReferenceStandardId;
  dateOfBirth: string;
  gender: Gender;
  lifeStage?: LifeStage;
  customProfile?: CustomReferenceProfile;
}): ResolvedReferenceConfig {
  const { standardId, dateOfBirth, gender, lifeStage = "none" } = opts;

  // Custom profile path
  if (opts.customProfile) {
    const profile = opts.customProfile;
    const ageGroup = AGE_GROUPS.find((g) => g.id === profile.ageGroupId);
    return {
      standardId: "custom",
      standardName: profile.name,
      ageGroupId: profile.ageGroupId,
      ageGroupLabel: ageGroup?.label ?? profile.ageGroupId,
      gender: profile.gender,
      lifeStage: profile.lifeStage,
      customProfileId: profile.id,
      values: resolveCustomProfile(profile),
    };
  }

  // Standard path
  const resolvedGender: "m" | "w" = gender === "d" ? "w" : gender;
  const age = getAgeFromDateOfBirth(dateOfBirth);
  const ageGroup = getAgeGroup(age);
  const standard = getReferenceStandard(standardId);

  return {
    standardId,
    standardName: standard?.shortName ?? standardId.toUpperCase(),
    ageGroupId: ageGroup.id,
    ageGroupLabel: ageGroup.label,
    gender: resolvedGender,
    lifeStage,
    values: resolveReferenceValues(standardId, ageGroup.id, resolvedGender, lifeStage),
  };
}

/**
 * Quick lookup: get a single nutrient's reference value from a resolved config.
 */
export function getReferenceAmount(
  config: ResolvedReferenceConfig,
  nutrientId: string,
): number {
  return config.values.find((v) => v.nutrientId === nutrientId)?.amount ?? 0;
}

/**
 * Convenience function matching the old API signature.
 * Used for backwards compatibility during migration.
 */
export function getReferenceForNutrientFromConfig(
  config: ResolvedReferenceConfig,
  nutrientId: string,
): number {
  return getReferenceAmount(config, nutrientId);
}
