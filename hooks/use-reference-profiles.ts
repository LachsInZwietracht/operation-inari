"use client";

import { useCallback, useEffect, useState } from "react";

import {
  deleteReferenceProfile,
  fetchOfficialReferenceValues,
  fetchPatientReferenceAssignments,
  fetchReferenceProfiles,
  fetchUserReferencePreference,
  getBundledReferenceValueRows,
  persistPatientReferenceAssignment,
  persistReferenceProfile,
  persistUserReferencePreference,
} from "@/lib/data/reference-values-client";
import { resolveReferenceForPatient } from "@/lib/reference-values";
import { resolveGender, resolveAgeGroupId } from "@/lib/reference-values";
import type {
  CustomReferenceProfile,
  Gender,
  LifeStage,
  OfficialReferenceValueRow,
  PatientReferenceAssignment,
  ReferenceStandardId,
  ResolvedReferenceConfig,
  UserReferencePreference,
} from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "prodi:reference-store:v2";

interface ReferenceStoreState {
  officialRows: OfficialReferenceValueRow[];
  customProfiles: CustomReferenceProfile[];
  userPreference: UserReferencePreference | null;
  patientAssignments: PatientReferenceAssignment[];
  initialized: boolean;
  loading: boolean;
}

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readStorage(): Omit<ReferenceStoreState, "officialRows" | "initialized" | "loading"> {
  if (typeof window === "undefined") {
    return { customProfiles: [], userPreference: null, patientAssignments: [] };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { customProfiles: [], userPreference: null, patientAssignments: [] };
    const parsed = JSON.parse(raw) as {
      customProfiles?: CustomReferenceProfile[];
      userPreference?: UserReferencePreference | null;
      patientAssignments?: PatientReferenceAssignment[];
    };
    return {
      customProfiles: parsed.customProfiles ?? [],
      userPreference: parsed.userPreference ?? null,
      patientAssignments: parsed.patientAssignments ?? [],
    };
  } catch {
    return { customProfiles: [], userPreference: null, patientAssignments: [] };
  }
}

const initialStorage = readStorage();

let store: ReferenceStoreState = {
  officialRows: getBundledReferenceValueRows(),
  customProfiles: initialStorage.customProfiles,
  userPreference: initialStorage.userPreference,
  patientAssignments: initialStorage.patientAssignments,
  initialized: false,
  loading: false,
};

function persistLocalState() {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      customProfiles: store.customProfiles,
      userPreference: store.userPreference,
      patientAssignments: store.patientAssignments,
    }),
  );
}

function updateStore(patch: Partial<ReferenceStoreState>) {
  store = { ...store, ...patch };
  persistLocalState();
  emitChange();
}

let inFlightLoad: Promise<void> | null = null;

async function ensureLoaded(isAuthenticated: boolean) {
  if (inFlightLoad) return inFlightLoad;
  if (store.initialized && (!isAuthenticated || store.userPreference || store.customProfiles.length >= 0)) {
    return;
  }

  updateStore({ loading: true });
  inFlightLoad = (async () => {
    try {
      const officialRows = await fetchOfficialReferenceValues();
      if (!isAuthenticated) {
        updateStore({ officialRows, initialized: true, loading: false });
        return;
      }

      const [customProfiles, userPreference, patientAssignments] = await Promise.all([
        fetchReferenceProfiles(),
        fetchUserReferencePreference(),
        fetchPatientReferenceAssignments(),
      ]);

      updateStore({
        officialRows,
        customProfiles,
        userPreference,
        patientAssignments,
        initialized: true,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to load reference profile state:", error);
      updateStore({ initialized: true, loading: false });
    } finally {
      inFlightLoad = null;
    }
  })();

  return inFlightLoad;
}

export function useReferenceProfiles() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribe(() => setTick((value) => value + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void ensureLoaded(isAuthenticated);
  }, [authLoading, isAuthenticated]);

  const setStandard = useCallback(
    async (id: Exclude<ReferenceStandardId, "custom">, patientId?: string, gender?: Gender, dateOfBirth?: string) => {
      if (patientId) {
        const existing = store.patientAssignments.find((item) => item.patientId === patientId);
        const assignment: PatientReferenceAssignment = {
          patientId,
          userId: existing?.userId ?? "local",
          standardId: id,
          profileId: undefined,
          lifeStage: existing?.lifeStage ?? "none",
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updateStore({
          patientAssignments: [
            ...store.patientAssignments.filter((item) => item.patientId !== patientId),
            assignment,
          ],
        });
        if (isAuthenticated) {
          const persisted = await persistPatientReferenceAssignment({
            patientId,
            standardId: id,
            profileId: undefined,
            lifeStage: assignment.lifeStage,
          });
          updateStore({
            patientAssignments: [
              ...store.patientAssignments.filter((item) => item.patientId !== patientId),
              persisted,
            ],
          });
        }
        return;
      }

      const nextPreference: UserReferencePreference = {
        userId: store.userPreference?.userId ?? "local",
        standardId: id,
        profileId: undefined,
        ageGroupId: resolveAgeGroupId(dateOfBirth),
        gender: resolveGender(gender ?? "w"),
        lifeStage: store.userPreference?.lifeStage ?? "none",
        createdAt: store.userPreference?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateStore({ userPreference: nextPreference });
      if (isAuthenticated) {
        const persisted = await persistUserReferencePreference({
          standardId: id,
          profileId: undefined,
          ageGroupId: nextPreference.ageGroupId,
          gender: nextPreference.gender,
          lifeStage: nextPreference.lifeStage,
        });
        updateStore({ userPreference: persisted });
      }
    },
    [isAuthenticated],
  );

  const setLifeStage = useCallback(
    async (lifeStage: LifeStage, patientId?: string, gender?: Gender, dateOfBirth?: string) => {
      if (patientId) {
        const existing = store.patientAssignments.find((item) => item.patientId === patientId);
        const assignment: PatientReferenceAssignment = {
          patientId,
          userId: existing?.userId ?? "local",
          standardId: existing?.standardId ?? "dge",
          profileId: existing?.profileId,
          lifeStage,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updateStore({
          patientAssignments: [
            ...store.patientAssignments.filter((item) => item.patientId !== patientId),
            assignment,
          ],
        });
        if (isAuthenticated) {
          const persisted = await persistPatientReferenceAssignment({
            patientId,
            standardId: assignment.standardId,
            profileId: assignment.profileId,
            lifeStage,
          });
          updateStore({
            patientAssignments: [
              ...store.patientAssignments.filter((item) => item.patientId !== patientId),
              persisted,
            ],
          });
        }
        return;
      }

      const nextPreference: UserReferencePreference = {
        userId: store.userPreference?.userId ?? "local",
        standardId: store.userPreference?.standardId ?? "dge",
        profileId: store.userPreference?.profileId,
        ageGroupId: store.userPreference?.ageGroupId ?? resolveAgeGroupId(dateOfBirth),
        gender: store.userPreference?.gender ?? resolveGender(gender ?? "w"),
        lifeStage,
        createdAt: store.userPreference?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateStore({ userPreference: nextPreference });
      if (isAuthenticated) {
        const persisted = await persistUserReferencePreference({
          standardId: nextPreference.standardId,
          profileId: nextPreference.profileId,
          ageGroupId: nextPreference.ageGroupId,
          gender: nextPreference.gender,
          lifeStage,
        });
        updateStore({ userPreference: persisted });
      }
    },
    [isAuthenticated],
  );

  const setProfile = useCallback(
    async (profileId: string, patientId?: string, gender?: Gender, dateOfBirth?: string) => {
      if (patientId) {
        const existing = store.patientAssignments.find((item) => item.patientId === patientId);
        const profile = store.customProfiles.find((item) => item.id === profileId);
        const assignment: PatientReferenceAssignment = {
          patientId,
          userId: existing?.userId ?? "local",
          standardId: undefined,
          profileId,
          lifeStage: profile?.lifeStage ?? existing?.lifeStage ?? "none",
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updateStore({
          patientAssignments: [
            ...store.patientAssignments.filter((item) => item.patientId !== patientId),
            assignment,
          ],
        });
        if (isAuthenticated) {
          const persisted = await persistPatientReferenceAssignment({
            patientId,
            standardId: undefined,
            profileId,
            lifeStage: assignment.lifeStage,
          });
          updateStore({
            patientAssignments: [
              ...store.patientAssignments.filter((item) => item.patientId !== patientId),
              persisted,
            ],
          });
        }
        return;
      }

      const profile = store.customProfiles.find((item) => item.id === profileId);
      const nextPreference: UserReferencePreference = {
        userId: store.userPreference?.userId ?? "local",
        standardId: undefined,
        profileId,
        ageGroupId: profile?.ageGroupId ?? store.userPreference?.ageGroupId ?? resolveAgeGroupId(dateOfBirth),
        gender: profile?.gender ?? store.userPreference?.gender ?? resolveGender(gender ?? "w"),
        lifeStage: profile?.lifeStage ?? store.userPreference?.lifeStage ?? "none",
        createdAt: store.userPreference?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateStore({ userPreference: nextPreference });
      if (isAuthenticated) {
        const persisted = await persistUserReferencePreference({
          standardId: undefined,
          profileId,
          ageGroupId: nextPreference.ageGroupId,
          gender: nextPreference.gender,
          lifeStage: nextPreference.lifeStage,
        });
        updateStore({ userPreference: persisted });
      }
    },
    [isAuthenticated],
  );

  const saveCustomProfile = useCallback(
    async (profile: CustomReferenceProfile) => {
      const localProfile = {
        ...profile,
        updatedAt: new Date().toISOString(),
      };
      updateStore({
        customProfiles: [
          ...store.customProfiles.filter((item) => item.id !== profile.id),
          localProfile,
        ],
      });
      if (isAuthenticated) {
        const persisted = await persistReferenceProfile({
          ...profile,
          id: profile.id,
        });
        updateStore({
          customProfiles: [
            ...store.customProfiles.filter((item) => item.id !== profile.id),
            persisted,
          ],
        });
      }
    },
    [isAuthenticated],
  );

  const removeCustomProfile = useCallback(
    async (profileId: string) => {
      updateStore({
        customProfiles: store.customProfiles.filter((item) => item.id !== profileId),
        patientAssignments: store.patientAssignments.map((item) =>
          item.profileId === profileId ? { ...item, profileId: undefined, standardId: "dge" } : item,
        ),
        userPreference:
          store.userPreference?.profileId === profileId
            ? { ...store.userPreference, profileId: undefined, standardId: "dge" }
            : store.userPreference,
      });
      if (isAuthenticated) {
        await deleteReferenceProfile(profileId);
      }
    },
    [isAuthenticated],
  );

  const getPatientAssignment = useCallback(
    (patientId: string) => store.patientAssignments.find((item) => item.patientId === patientId) ?? null,
    [],
  );

  const getResolvedConfig = useCallback(
    ({
      patientId,
      dateOfBirth,
      gender = "w",
    }: {
      patientId?: string;
      dateOfBirth?: string;
      gender?: Gender;
    }): ResolvedReferenceConfig =>
      resolveReferenceForPatient({
        patientId,
        dateOfBirth,
        gender,
        officialRows: store.officialRows,
        customProfiles: store.customProfiles,
        userPreference: store.userPreference,
        patientAssignment: patientId ? getPatientAssignment(patientId) : null,
      }),
    [getPatientAssignment],
  );

  return {
    officialRows: store.officialRows,
    customProfiles: store.customProfiles,
    userPreference: store.userPreference,
    patientAssignments: store.patientAssignments,
    standardId: store.userPreference?.standardId ?? "dge",
    selectedProfileId: store.userPreference?.profileId,
    lifeStage: store.userPreference?.lifeStage ?? "none",
    isLoadingRemote: store.loading || authLoading,
    setStandard,
    setLifeStage,
    setProfile,
    saveCustomProfile,
    deleteCustomProfile: removeCustomProfile,
    getPatientAssignment,
    getResolvedConfig,
  };
}
