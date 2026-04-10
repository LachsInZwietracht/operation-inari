"use client"

import { useCallback, useEffect, useState } from "react"
import type { ReportTemplate } from "@/lib/types"
import { REPORT_TEMPLATES } from "@/lib/mock-data"

const STORAGE_KEY = "prodi_report_templates"

function loadTemplatesFromStorage(): ReportTemplate[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ReportTemplate[]
  } catch {
    // ignore parse errors
  }
  return []
}

function buildInitialTemplates(): ReportTemplate[] {
  const stored = loadTemplatesFromStorage()
  const storedIds = new Set(stored.map((template) => template.id))
  const seed = REPORT_TEMPLATES.filter((template) => !storedIds.has(template.id))
  return [...seed, ...stored].sort((a, b) => a.name.localeCompare(b.name))
}

export function useReportTemplates() {
  const [templates, setTemplates] = useState<ReportTemplate[]>(buildInitialTemplates)

  useEffect(() => {
    try {
      const custom = templates.filter((template) => !REPORT_TEMPLATES.some((seed) => seed.id === template.id))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
    } catch {
      // ignore quota
    }
  }, [templates])

  const addTemplate = useCallback((data: Omit<ReportTemplate, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString()
    const template: ReportTemplate = {
      ...data,
      id: `report_template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    }
    setTemplates((prev) => [...prev, template].sort((a, b) => a.name.localeCompare(b.name)))
    return template
  }, [])

  const updateTemplate = useCallback((id: string, data: Partial<Omit<ReportTemplate, "id">>) => {
    setTemplates((prev) =>
      prev.map((template) =>
        template.id === id
          ? {
              ...template,
              ...data,
              updatedAt: new Date().toISOString(),
            }
          : template,
      ),
    )
  }, [])

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((template) => template.id !== id))
  }, [])

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  }
}
