"use client"

import { Sparkles } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { ClientDayHighlight } from "@/lib/client-day-summary"

/**
 * The last thing on the page: what went well.
 *
 * Deliberately at the bottom and deliberately one-sided. Everything above it
 * is a measurement; this is the only part that has an opinion, and the opinion
 * is always in the person's favour. Nothing true to say means no card — an
 * empty compliment is worse than silence.
 */
export function ClientDaySummary({ highlights }: { highlights: ClientDayHighlight[] }) {
  if (highlights.length === 0) return null

  return (
    <Card>
      <CardContent className="flex gap-3 py-4">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium">Das lief heute gut</p>
          <ul className="space-y-0.5">
            {highlights.map((highlight) => (
              <li key={highlight.id} className="text-sm text-muted-foreground">
                {highlight.text}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
