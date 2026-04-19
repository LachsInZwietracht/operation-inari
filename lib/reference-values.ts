import { differenceInYears, parseISO } from "date-fns";

import { AGE_GROUPS, REFERENCE_STANDARD_METADATA } from "@/lib/reference-metadata";
import type {
  AgeGroup,
  CustomReferenceProfile,
  Gender,
  LifeStage,
  OfficialReferenceValueRow,
  PatientReferenceAssignment,
  ReferenceDemographicContext,
  ReferenceNutrientValue,
  ReferenceStandardId,
  ResolvedReferenceConfig,
  UserReferencePreference,
} from "@/lib/types";

const DEFAULT_AGE_GROUP_ID = "25-51";

export function getAgeGroup(ageInYears: number): AgeGroup {
  const group = AGE_GROUPS.find((g) => ageInYears >= g.minAge && ageInYears < g.maxAge);
  return group ?? AGE_GROUPS.find((g) => g.id === DEFAULT_AGE_GROUP_ID)!;
}

export function getAgeFromDateOfBirth(dateOfBirth: string): number {
  return differenceInYears(new Date(), parseISO(dateOfBirth));
}

export function resolveAgeGroupId(dateOfBirth?: string): string {
  if (!dateOfBirth) return DEFAULT_AGE_GROUP_ID;
  return getAgeGroup(getAgeFromDateOfBirth(dateOfBirth)).id;
}

export function resolveGender(gender: Gender): "m" | "w" {
  return gender === "m" ? "m" : "w";
}

export function resolveReferenceValuesFromRows(
  rows: OfficialReferenceValueRow[],
  standardId: Exclude<ReferenceStandardId, "custom">,
  ageGroupId: string,
  gender: "m" | "w",
  lifeStage: LifeStage = "none",
): ReferenceNutrientValue[] {
  const filtered = rows.filter((row) => {
    if (row.standardId !== standardId) return false;
    if (row.gender !== gender) return false;
    if (row.ageGroupId !== ageGroupId) return false;
    return lifeStage === "none" ? row.lifeStage === "none" : row.lifeStage === lifeStage;
  });

  if (filtered.length > 0) {
    return filtered.map((row) => ({ nutrientId: row.nutrientId, amount: row.amount }));
  }

  if (lifeStage !== "none") {
    return resolveReferenceValuesFromRows(rows, standardId, ageGroupId, gender, "none");
  }

  return [];
}

export function resolveReferenceValues(
  standardId: Exclude<ReferenceStandardId, "custom">,
  ageGroupId: string,
  gender: "m" | "w",
  lifeStage: LifeStage = "none",
  rows: OfficialReferenceValueRow[] = [],
): ReferenceNutrientValue[] {
  return resolveReferenceValuesFromRows(rows, standardId, ageGroupId, gender, lifeStage);
}

export function resolveCustomProfile(
  profile: CustomReferenceProfile,
  rows: OfficialReferenceValueRow[] = [],
): ReferenceNutrientValue[] {
  const baseValues = profile.basedOn
    ? resolveReferenceValues(
        profile.basedOn as Exclude<ReferenceStandardId, "custom">,
        profile.ageGroupId,
        profile.gender,
        profile.lifeStage,
        rows,
      )
    : [];

  if (profile.overrides.length === 0) return baseValues;

  const overrideMap = new Map(profile.overrides.map((item) => [item.nutrientId, item.amount]));
  const merged = baseValues.map((value) => ({
    nutrientId: value.nutrientId,
    amount: overrideMap.get(value.nutrientId) ?? value.amount,
  }));

  for (const override of profile.overrides) {
    if (!merged.find((value) => value.nutrientId === override.nutrientId)) {
      merged.push(override);
    }
  }

  return merged;
}

interface ResolveReferenceOptions extends ReferenceDemographicContext {
  officialRows?: OfficialReferenceValueRow[];
  customProfiles?: CustomReferenceProfile[];
  userPreference?: UserReferencePreference | null;
  patientAssignment?: PatientReferenceAssignment | null;
}

export function resolveReferenceForPatient({
  dateOfBirth,
  gender,
  patientId,
  officialRows = [],
  customProfiles = [],
  userPreference = null,
  patientAssignment = null,
}: ResolveReferenceOptions): ResolvedReferenceConfig {
  const resolvedGender = resolveGender(gender);
  const ageGroupId = resolveAgeGroupId(dateOfBirth);
  const ageGroupLabel = AGE_GROUPS.find((group) => group.id === ageGroupId)?.label ?? ageGroupId;
  const activeAssignment = patientId ? patientAssignment : null;
  const effectiveLifeStage = activeAssignment?.lifeStage ?? userPreference?.lifeStage ?? "none";
  const effectiveAgeGroupId = activeAssignment ? ageGroupId : userPreference?.ageGroupId ?? ageGroupId;
  const effectiveGender = activeAssignment ? resolvedGender : userPreference?.gender ?? resolvedGender;

  const activeProfileId = activeAssignment?.profileId ?? userPreference?.profileId;
  if (activeProfileId) {
    const profile = customProfiles.find((item) => item.id === activeProfileId);
    if (profile) {
      return {
        standardId: "custom",
        standardName: profile.name,
        ageGroupId: profile.ageGroupId,
        ageGroupLabel: AGE_GROUPS.find((group) => group.id === profile.ageGroupId)?.label ?? profile.ageGroupId,
        gender: profile.gender,
        lifeStage: profile.lifeStage,
        customProfileId: profile.id,
        values: resolveCustomProfile(profile, officialRows),
      };
    }
  }

  const standardId = activeAssignment?.standardId ?? userPreference?.standardId ?? "dge";
  const metadata = REFERENCE_STANDARD_METADATA[standardId];

  return {
    standardId,
    standardName: metadata?.shortName ?? standardId.toUpperCase(),
    ageGroupId: effectiveAgeGroupId,
    ageGroupLabel: AGE_GROUPS.find((group) => group.id === effectiveAgeGroupId)?.label ?? ageGroupLabel,
    gender: effectiveGender,
    lifeStage: effectiveLifeStage,
    values: resolveReferenceValues(
      standardId,
      effectiveAgeGroupId,
      effectiveGender,
      effectiveLifeStage,
      officialRows,
    ),
  };
}

export function getReferenceAmount(config: ResolvedReferenceConfig, nutrientId: string): number {
  return config.values.find((value) => value.nutrientId === nutrientId)?.amount ?? 0;
}

export function getReferenceForNutrientFromConfig(
  config: ResolvedReferenceConfig,
  nutrientId: string,
): number {
  return getReferenceAmount(config, nutrientId);
}
