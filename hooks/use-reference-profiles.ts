"use client";

import { useCallback, useSyncExternalStore } from "react";
import type {
  CustomReferenceProfile,
  LifeStage,
  ReferenceStandardId,
} from "@/lib/types";

// ── Storage keys ───────────────────────────────────────────────

const STORAGE_KEY_STANDARD = "prodi:reference-standard";
const STORAGE_KEY_LIFE_STAGE = "prodi:reference-life-stage";
const STORAGE_KEY_CUSTOM_PROFILES = "prodi:custom-reference-profiles";

// ── Pub/Sub for cross-component reactivity ─────────────────────

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Snapshot helpers ───────────────────────────────────────────

function getStandardSnapshot(): ReferenceStandardId {
  if (typeof window === "undefined") return "dge";
  return (localStorage.getItem(STORAGE_KEY_STANDARD) as ReferenceStandardId) ?? "dge";
}

function getLifeStageSnapshot(): LifeStage {
  if (typeof window === "undefined") return "none";
  return (localStorage.getItem(STORAGE_KEY_LIFE_STAGE) as LifeStage) ?? "none";
}

let cachedProfiles: CustomReferenceProfile[] = [];
let cachedProfilesJSON: string | null = null;

function getCustomProfilesSnapshot(): CustomReferenceProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_PROFILES);
    if (raw === cachedProfilesJSON) {
      return cachedProfiles;
    }
    cachedProfilesJSON = raw;
    cachedProfiles = raw ? JSON.parse(raw) : [];
    return cachedProfiles;
  } catch {
    cachedProfilesJSON = null;
    cachedProfiles = [];
    return cachedProfiles;
  }
}

// Server snapshots (for SSR hydration)
const serverStandard = (): ReferenceStandardId => "dge";
const serverLifeStage = (): LifeStage => "none";
const serverProfiles = (): CustomReferenceProfile[] => [];

// ── Hook ───────────────────────────────────────────────────────

export function useReferenceProfiles() {
  const standardId = useSyncExternalStore(subscribe, getStandardSnapshot, serverStandard);
  const lifeStage = useSyncExternalStore(subscribe, getLifeStageSnapshot, serverLifeStage);
  const customProfiles = useSyncExternalStore(subscribe, getCustomProfilesSnapshot, serverProfiles);

  const setStandard = useCallback((id: ReferenceStandardId) => {
    localStorage.setItem(STORAGE_KEY_STANDARD, id);
    emitChange();
  }, []);

  const setLifeStage = useCallback((stage: LifeStage) => {
    localStorage.setItem(STORAGE_KEY_LIFE_STAGE, stage);
    emitChange();
  }, []);

  const saveCustomProfile = useCallback((profile: CustomReferenceProfile) => {
    const profiles = getCustomProfilesSnapshot();
    const idx = profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx] = profile;
    } else {
      profiles.push(profile);
    }
    const raw = JSON.stringify(profiles);
    localStorage.setItem(STORAGE_KEY_CUSTOM_PROFILES, raw);
    cachedProfiles = profiles;
    cachedProfilesJSON = raw;
    emitChange();
  }, []);

  const deleteCustomProfile = useCallback((profileId: string) => {
    const profiles = getCustomProfilesSnapshot().filter((p) => p.id !== profileId);
    const raw = JSON.stringify(profiles);
    localStorage.setItem(STORAGE_KEY_CUSTOM_PROFILES, raw);
    cachedProfiles = profiles;
    cachedProfilesJSON = raw;
    emitChange();
  }, []);

  return {
    standardId,
    lifeStage,
    customProfiles,
    setStandard,
    setLifeStage,
    saveCustomProfile,
    deleteCustomProfile,
  };
}
