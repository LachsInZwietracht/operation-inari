"use client"

import { useEffect, useRef, useState } from "react"
import { Droplets, Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ClientWeightField } from "@/components/client/client-weight-field"
import type { ClientWeighIn } from "@/lib/data/client-anthropometrics-client"

/** One glass. The fast path counts glasses; the field next to it takes any amount. */
const GLASS_ML = 250
const MAX_ML = 10000
const NOTE_DEBOUNCE_MS = 800
const WATER_DEBOUNCE_MS = 800

/**
 * The things about a day that are not the food.
 *
 * The note is the more valuable of the two and the cheaper: "Einladung bei
 * Freunden", "kaum geschlafen" is the line that explains the macros around it,
 * and it is what a dietitian reads first. The column has existed since the
 * module was built and never had a field.
 *
 * Water counts in glasses because that is how people drink it — but only on the
 * fast path. A glass is 250 ml by assumption, and that assumption is wrong for
 * anyone drinking from a 0,7-l bottle or refilling a 1,5-l one at their desk;
 * counting their day in quarter-litre steps turns a known number into an
 * estimate. So the litres sit in a field of their own and take any value, and
 * the buttons stay for the people the glass was right for.
 */
export function ClientDayContext({
  date,
  waterMl,
  notes,
  weightKg,
  weightMeasuredOn,
  onWaterChange,
  onNotesChange,
  onWeightRecorded,
}: {
  date: string
  waterMl?: number
  notes?: string
  /** The most recent known weight, whoever recorded it. */
  weightKg?: number
  weightMeasuredOn?: string
  onWaterChange: (waterMl: number) => void
  onNotesChange: (notes: string) => void
  onWeightRecorded: (entry: ClientWeighIn) => void
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

  // `null` means "not being typed in": the field then follows whatever the
  // buttons did. While it holds a string, the person is mid-entry and nothing
  // outside is allowed to rewrite what they are typing.
  const [litreDraft, setLitreDraft] = useState<string | null>(null)
  const waterTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (waterTimerRef.current !== null) window.clearTimeout(waterTimerRef.current)
    }
  }, [])

  function handleLitreInput(raw: string) {
    setLitreDraft(raw)

    // Both notations, because the keyboard on a phone offers the point and the
    // language offers the comma.
    const parsed = Number.parseFloat(raw.replace(",", "."))
    if (raw.trim() === "" || Number.isNaN(parsed) || parsed < 0) return

    const millilitres = Math.min(MAX_ML, Math.round(parsed * 1000))
    if (waterTimerRef.current !== null) window.clearTimeout(waterTimerRef.current)
    waterTimerRef.current = window.setTimeout(() => {
      waterTimerRef.current = null
      onWaterChange(millilitres)
    }, WATER_DEBOUNCE_MS)
  }

  const litreValue =
    litreDraft ??
    (waterMl === undefined ? "" : String(Math.round(waterMl) / 1000).replace(".", ","))

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-3">
          <Droplets className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-1 items-center gap-2">
            <Input
              inputMode="decimal"
              aria-label="Getrunken in Litern"
              placeholder="0"
              className="h-8 w-20 text-sm tabular-nums"
              value={litreValue}
              onChange={(event) => handleLitreInput(event.target.value)}
              onBlur={() => setLitreDraft(null)}
            />
            <span className="text-sm text-muted-foreground">
              l
              <span className="ml-2 text-xs tabular-nums">
                ≈ {glasses} {glasses === 1 ? "Glas" : "Gläser"}
              </span>
            </span>
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

        <ClientWeightField
          date={date}
          weightKg={weightKg}
          measuredOn={weightMeasuredOn}
          onRecorded={onWeightRecorded}
        />

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
