"use client"

import { useCallback, useState } from "react"

import { DEMO_HISTORY, type DemoRevision, type DemoReleaseStatus } from "./demo-extras"

/**
 * The plan's life cycle, as the app now models it.
 *
 * A released stand is immutable and visible to the client. Changing it does not
 * edit it — it opens a new draft that supersedes it, and the old stand is only
 * marked "ersetzt" once the successor is released. All three drafts share this
 * state machine so the workflow reads the same in each of them.
 *
 * In-memory only; nothing is written.
 */
export function useDemoRelease(initial: DemoReleaseStatus = "draft") {
  const [status, setStatus] = useState<DemoReleaseStatus>(initial)
  const [history, setHistory] = useState<DemoRevision[]>(DEMO_HISTORY)

  /** Stand the counselor is working on — the next number after the last release. */
  const revision = history.length + (status === "released" ? 0 : 1)

  const release = useCallback(() => {
    setHistory((current) => {
      const now = new Date().toLocaleDateString("de-DE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
      const replaced = current.map((entry) =>
        entry.replacedAt === null ? { ...entry, replacedAt: now } : entry,
      )
      return [
        ...replaced,
        {
          revision: current.length + 1,
          releasedAt: now,
          replacedAt: null,
          note: "In dieser Sitzung freigegeben",
        },
      ]
    })
    setStatus("released")
  }, [])

  const beginRevision = useCallback(() => setStatus("revision"), [])

  const reset = useCallback(() => {
    setHistory(DEMO_HISTORY)
    setStatus(initial)
  }, [initial])

  const current = history.find((entry) => entry.replacedAt === null) ?? null

  return { status, revision, history, current, release, beginRevision, reset }
}

export type DemoReleaseApi = ReturnType<typeof useDemoRelease>
