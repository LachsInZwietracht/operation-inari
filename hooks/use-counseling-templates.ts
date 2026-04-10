"use client";

import { useCallback, useEffect, useState } from "react";
import type { CounselingTemplate } from "@/lib/types";
import { COUNSELING_TEMPLATES } from "@/lib/mock-data";

const STORAGE_KEY = "prodi_counseling_templates";

function loadFromStorage(): CounselingTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CounselingTemplate[];
  } catch {
    return [];
  }
  return [];
}

function buildInitial(): CounselingTemplate[] {
  const stored = loadFromStorage();
  const ids = new Set(stored.map((tpl) => tpl.id));
  return [...COUNSELING_TEMPLATES.filter((tpl) => !ids.has(tpl.id)), ...stored];
}

export function useCounselingTemplates() {
  const [templates, setTemplates] = useState<CounselingTemplate[]>(buildInitial);

  useEffect(() => {
    const custom = templates.filter(
      (tpl) => !COUNSELING_TEMPLATES.find((mock) => mock.id === tpl.id),
    );
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
    } catch {
      // ignore
    }
  }, [templates]);

  const addTemplate = useCallback(
    (payload: Omit<CounselingTemplate, "id">) => {
      const tpl: CounselingTemplate = {
        ...payload,
        id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      };
      setTemplates((prev) => [tpl, ...prev]);
      return tpl;
    },
    [],
  );

  const updateTemplate = useCallback((id: string, updates: Partial<CounselingTemplate>) => {
    setTemplates((prev) => prev.map((tpl) => (tpl.id === id ? { ...tpl, ...updates } : tpl)));
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
  }, []);

  return { templates, addTemplate, updateTemplate, deleteTemplate };
}
