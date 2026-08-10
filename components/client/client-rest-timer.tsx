"use client"

import { useEffect, useState } from "react"
import { Check, Timer, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Rest timer between sets.
 *
 * Counts *up* from the moment a set was saved rather than down from a goal:
 * the elapsed time is the fact, the target is a preference. When the target is
 * reached the bar changes state instead of making a sound — a gym app that
 * beeps needs audio permission and an unlock gesture, and the phone is in the
 * person's hand anyway.
 *
 * Nothing here is persisted server-side; a rest that outlives the page was not
 * a rest.
 */
const TARGETS = [60, 90, 120] as const
const STORAGE_KEY = "prodi.client.restTarget"

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`
}

export function ClientRestTimer({
  startedAt,
  onDismiss,
}: {
  /** Epoch ms of the last saved set; remounts the count on every new set. */
  startedAt: number
  onDismiss: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const [target, setTarget] = useState<number>(90)

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY))
    if (TARGETS.includes(stored as (typeof TARGETS)[number])) setTarget(stored)
  }, [])

  useEffect(() => {
    // Derived from the timestamp, not incremented, so a backgrounded tab that
    // stops firing intervals still shows the right number when it returns.
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [startedAt])

  function selectTarget(next: number) {
    setTarget(next)
    window.localStorage.setItem(STORAGE_KEY, String(next))
  }

  const isReady = elapsed >= target

  return (
    <div
      className="fixed inset-x-0 bottom-16 z-20 border-t bg-background/95 backdrop-blur"
      role="status"
      aria-live="off"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium tabular-nums",
            isReady ? "text-primary" : "text-foreground",
          )}
        >
          {isReady ? <Check className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
          {formatElapsed(elapsed)}
        </span>

        <span className="text-xs text-muted-foreground">{isReady ? "Bereit" : "Pause"}</span>

        <div className="ml-auto flex items-center gap-1">
          {TARGETS.map((seconds) => (
            <Button
              key={seconds}
              variant={seconds === target ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs tabular-nums"
              aria-pressed={seconds === target}
              onClick={() => selectTarget(seconds)}
            >
              {seconds}s
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Pause beenden" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
