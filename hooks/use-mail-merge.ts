"use client"

import { useCallback, useEffect, useState } from "react"

import type { MailMergeBatch, MailMergeDocument } from "@/lib/types"

const STORAGE_KEY = "prodi_mail_merge_batches"

function loadFromStorage(): MailMergeBatch[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as MailMergeBatch[]
  } catch {
    return []
  }
}

export function useMailMergeHistory() {
  const [batches, setBatches] = useState<MailMergeBatch[]>(loadFromStorage)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(batches))
    } catch {
      // Ignore quota errors
    }
  }, [batches])

  const logBatch = useCallback(
    (payload: {
      templateId?: string
      templateName: string
      documents: MailMergeDocument[]
    }) => {
      const timestamp = new Date().toISOString()
      const batch: MailMergeBatch = {
        id: `mail_batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        templateId: payload.templateId,
        templateName: payload.templateName,
        recipientCount: payload.documents.length,
        documentSample: payload.documents[0],
        status: "ready",
        downloadName: `Serienbrief-${timestamp.slice(0, 10)}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setBatches((prev) => [batch, ...prev])
      return batch
    },
    [],
  )

  const markExported = useCallback((batchId: string) => {
    setBatches((prev) =>
      prev.map((batch) =>
        batch.id === batchId
          ? { ...batch, status: "exported", updatedAt: new Date().toISOString() }
          : batch,
      ),
    )
  }, [])

  return { batches, logBatch, markExported }
}
