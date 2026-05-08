"use client"

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  deleteDietLinePresetClient,
  fetchDietLinePresetsClient,
  getBundledDietLinePresets,
  saveDietLinePresetClient,
} from "@/lib/data/diet-lines-client";
import type { DietLinePreset } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";

interface SaveDietLinePresetInput {
  id?: string;
  name: string;
  description: string;
  targets: DietLinePreset["targets"];
}

function mergePresets(bundled: DietLinePreset[], persisted: DietLinePreset[]) {
  const byId = new Map<string, DietLinePreset>();
  for (const preset of bundled) {
    byId.set(preset.id, preset);
  }
  for (const preset of persisted) {
    byId.set(preset.id, preset);
  }
  return Array.from(byId.values());
}

export function useDietLinePresets() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const bundledPresets = useMemo(() => getBundledDietLinePresets(), []);
  const [persistedPresets, setPersistedPresets] = useState<DietLinePreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    let cancelled = false;
    setIsLoading(true);

    async function loadPresets() {
      try {
        const nextPresets = await fetchDietLinePresetsClient();
        if (!cancelled) {
          setPersistedPresets(nextPresets);
        }
      } catch (error) {
        console.error("Failed to load diet line presets:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPresets();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const savePreset = useCallback(async (input: SaveDietLinePresetInput) => {
    const savedPreset = await saveDietLinePresetClient(input);
    setPersistedPresets((prev) => {
      const withoutSaved = prev.filter((preset) => preset.id !== savedPreset.id);
      return [...withoutSaved, savedPreset].sort((a, b) => a.name.localeCompare(b.name, "de"));
    });
    return savedPreset;
  }, []);

  const deletePreset = useCallback(async (id: string) => {
    await deleteDietLinePresetClient(id);
    setPersistedPresets((prev) => prev.filter((preset) => preset.id !== id));
  }, []);

  const presets = useMemo(
    () => mergePresets(bundledPresets, persistedPresets),
    [bundledPresets, persistedPresets],
  );

  return {
    presets,
    isLoading,
    savePreset,
    deletePreset,
  };
}
