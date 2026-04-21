"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import type { CounselingTemplate } from "@/lib/types"
import { COUNSELING_TEMPLATES } from "@/lib/mock-data"
import {
  deleteCounselingTemplateClient,
  fetchCounselingTemplatesClient,
  persistCounselingTemplate,
} from "@/lib/data/counseling-client"
import { useAuth } from "@/hooks/use-auth"

const STORAGE_KEY = "prodi_counseling_templates"

function loadFromStorage(): CounselingTemplate[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as CounselingTemplate[]
  } catch {
    // Ignore parse errors
  }
  return []
}

function sortTemplates(templates: CounselingTemplate[]): CounselingTemplate[] {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name, "de"))
}

function buildInitial(): CounselingTemplate[] {
  const stored = loadFromStorage()
  const storedIds = new Set(stored.flatMap((template) => [template.id, template.legacyId].filter(Boolean)))
  const mockOnly = COUNSELING_TEMPLATES.filter((template) => !storedIds.has(template.id))
  return sortTemplates([...mockOnly, ...stored])
}

function isMockTemplate(template: CounselingTemplate) {
  return COUNSELING_TEMPLATES.some((mockTemplate) => mockTemplate.id === template.id)
}

function getLocalOnlyTemplates(templates: CounselingTemplate[]) {
  return templates.filter((template) => !isMockTemplate(template))
}

export function useCounselingTemplates() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [templates, setTemplates] = useState<CounselingTemplate[]>(buildInitial)
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const migrationDone = useRef(false)
  const templatesRef = useRef<CounselingTemplate[]>(templates)

  useEffect(() => {
    templatesRef.current = templates
  }, [templates])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getLocalOnlyTemplates(templates)))
    } catch {
      // Ignore quota errors
    }
  }, [templates])

  useEffect(() => {
    if (!isAuthenticated || authLoading) return

    let cancelled = false
    setIsLoadingRemote(true)

    async function syncTemplates() {
      try {
        const remoteTemplates = await fetchCounselingTemplatesClient()
        if (cancelled) return

        const localOnly = getLocalOnlyTemplates(templatesRef.current)
        const merged = [...remoteTemplates]

        for (const localTemplate of localOnly) {
          const existsRemote = remoteTemplates.some(
            (remoteTemplate) =>
              remoteTemplate.id === localTemplate.id || remoteTemplate.legacyId === localTemplate.id,
          )
          if (!existsRemote) {
            merged.push(localTemplate)
          }
        }

        setTemplates(sortTemplates(merged))

        if (!migrationDone.current) {
          migrationDone.current = true

          const pendingMigration = localOnly.filter(
            (localTemplate) =>
              !remoteTemplates.some(
                (remoteTemplate) =>
                  remoteTemplate.id === localTemplate.id || remoteTemplate.legacyId === localTemplate.id,
              ),
          )

          for (const template of pendingMigration) {
            void persistCounselingTemplate(template).catch((error) => {
              console.error(`Failed to migrate counseling template ${template.id}:`, error)
            })
          }
        }
      } catch (error) {
        console.error("Failed to sync counseling templates from Supabase:", error)
      } finally {
        if (!cancelled) setIsLoadingRemote(false)
      }
    }

    void syncTemplates()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, authLoading])

  const addTemplate = useCallback(
    async (payload: Omit<CounselingTemplate, "id">) => {
      const tempId = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const draftTemplate: CounselingTemplate = {
        ...payload,
        id: tempId,
      }

      setTemplates((prev) => sortTemplates([draftTemplate, ...prev]))

      if (!isAuthenticated) {
        return draftTemplate
      }

      try {
        const persisted = await persistCounselingTemplate(draftTemplate)
        setTemplates((prev) =>
          sortTemplates(prev.map((template) => (template.id === tempId ? persisted : template))),
        )
        return persisted
      } catch (error) {
        console.error("Failed to persist counseling template:", error)
        return draftTemplate
      }
    },
    [isAuthenticated],
  )

  const updateTemplate = useCallback(
    (id: string, updates: Partial<CounselingTemplate>) => {
      const existing = templatesRef.current.find((template) => template.id === id || template.legacyId === id)
      if (!existing) return

      const updated: CounselingTemplate = {
        ...existing,
        ...updates,
      }

      setTemplates((prev) =>
        sortTemplates(
          prev.map((template) =>
            template.id === id || template.legacyId === id
              ? updated
              : template,
          ),
        ),
      )

      if (!isAuthenticated) return

      void persistCounselingTemplate(updated)
        .then((persisted) => {
          setTemplates((current) =>
            sortTemplates(
              current.map((template) =>
                template.id === id || template.id === persisted.legacyId || template.legacyId === id
                  ? persisted
                  : template,
              ),
            ),
          )
        })
        .catch((error) => {
          console.error("Failed to update counseling template in Supabase:", error)
        })
    },
    [isAuthenticated],
  )

  const deleteTemplate = useCallback(
    (id: string) => {
      const deletedTemplate = templatesRef.current.find(
        (template) => template.id === id || template.legacyId === id,
      )
      if (!deletedTemplate) return

      setTemplates((prev) => prev.filter((template) => template.id !== id && template.legacyId !== id))
      if (isAuthenticated) {
        void deleteCounselingTemplateClient(id).catch((error) => {
          console.error("Failed to delete counseling template in Supabase:", error)
          setTemplates((prev) => {
            const alreadyRestored = prev.some(
              (template) =>
                template.id === deletedTemplate.id || template.legacyId === deletedTemplate.id,
            )
            if (alreadyRestored) return prev
            return sortTemplates([...prev, deletedTemplate])
          })
          toast.error("Beratungsvorlage konnte nicht gelöscht werden")
        })
      }
    },
    [isAuthenticated],
  )

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    isLoadingRemote,
  }
}
