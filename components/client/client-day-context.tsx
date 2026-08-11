"use client"

import { useEffect, useRef, useState } from "react"
import { Droplets, Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

/** One glass. Water gets logged in glasses, not in millilitres. */
const GLASS_ML = 250
const MAX_ML = 5000
const NOTE_DEBOUNCE_MS = 800

/**
 * The two things about a day that are not a number.
 *
 * The note is the more valuable of the two and the cheaper: "Einladung bei
 * Freunden", "kaum geschlafen" is the line that explains the macros around it,
 * and it is what a dietitian reads first. The column has existed since the
 * module was built and never had a field.
 *
 * Water counts in glasses because that is how people drink it; the millilitres
 * are an implementation detail shown alongside.
 */
export function ClientDayContext({
  waterMl,
  notes,
  onWaterChange,
  onNotesChange,
}: {
  waterMl?: number
  notes?: string
  onWaterChange: (waterMl: number) => void
  onNotesChange: (notes: string) => void
}) {
  const [noteDraft, setNoteDraft] = useState(notes ?? "")
  const savedRef = useRef(notes ?? "")

  // Typing should not be a save button. Debounced, and only when it changed —
  // a note is written slowly and in the middle of a thought.
  useEffect(() => {
    if (noteDraft === savedRef.current) return

    const timer = window.setTimeout(() => {
      savedRef.current = noteDraft
      onNotesChange(noteDraft)
    }, NOTE_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [noteDraft, onNotesChange])

  const glasses = Math.round((waterMl ?? 0) / GLASS_ML)

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-3">
          <Droplets className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium tabular-nums">
              {glasses} {glasses === 1 ? "Glas" : "Gläser"}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {((waterMl ?? 0) / 1000).toFixed(1).replace(".", ",")} l
              </span>
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Ein Glas weniger"
            disabled={(waterMl ?? 0) <= 0}
            onClick={() => onWaterChange(Math.max(0, (waterMl ?? 0) - GLASS_ML))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Ein Glas mehr"
            disabled={(waterMl ?? 0) >= MAX_ML}
            onClick={() => onWaterChange(Math.min(MAX_ML, (waterMl ?? 0) + GLASS_ML))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <Textarea
          rows={2}
          placeholder="Wie war der Tag? (z. B. Einladung, Stress, wenig Schlaf)"
          className="resize-none text-sm"
          aria-label="Notiz zum Tag"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
        />
      </CardContent>
    </Card>
  )
}
