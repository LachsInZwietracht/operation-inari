"use client"

import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { de } from "date-fns/locale"

import {
  clientLogEntryLabel,
  formatLogAmount,
  logEntryKcal,
  type ClientRecentEntry,
} from "@/lib/client-food-log"
import { todayIsoDate } from "@/lib/client-mode"
import { MEAL_SLOT_LABELS } from "@/lib/constants"
import type { Food, MealSlotType, NutrientValue } from "@/lib/types"

/**
 * What this person has been eating, as the first thing the add dialog shows.
 *
 * The chips this replaces were faster to glance at but capped at six and
 * ordered by frequency alone, so "what I had last night" was unreachable. A
 * list costs no extra tap — it is the tab the dialog opens on — and it can
 * carry the amount and the energy, which is what makes a row tappable without
 * a second thought.
 */
export function ClientRecentEntryList({
  entries,
  slot,
  foods,
  recipeFacts,
  recipeNames,
  onPick,
}: {
  entries: ClientRecentEntry[]
  slot: MealSlotType
  foods: Map<string, Food>
  recipeFacts?: Map<string, NutrientValue[]>
  recipeNames?: Map<string, string>
  onPick: (recent: ClientRecentEntry) => void
}) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Hier stehen bald die Sachen, die du öfter isst.
      </p>
    )
  }

  const inSlot = entries.filter((entry) => entry.inSlot)
  const elsewhere = entries.filter((entry) => !entry.inSlot)

  return (
    <div className="max-h-80 space-y-3 overflow-y-auto">
      {inSlot.length > 0 && (
        <Section title={`Oft zum ${MEAL_SLOT_LABELS[slot]}`}>
          {inSlot.map((recent) => (
            <Row
              key={recent.key}
              recent={recent}
              foods={foods}
              recipeFacts={recipeFacts}
              recipeNames={recipeNames}
              onPick={onPick}
            />
          ))}
        </Section>
      )}

      {elsewhere.length > 0 && (
        <Section title="Zuletzt gegessen">
          {elsewhere.map((recent) => (
            <Row
              key={recent.key}
              recent={recent}
              foods={foods}
              recipeFacts={recipeFacts}
              recipeNames={recipeNames}
              onPick={onPick}
            />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{title}</p>
      <ul className="divide-y rounded-md border">{children}</ul>
    </div>
  )
}

function Row({
  recent,
  foods,
  recipeFacts,
  recipeNames,
  onPick,
}: {
  recent: ClientRecentEntry
  foods: Map<string, Food>
  recipeFacts?: Map<string, NutrientValue[]>
  recipeNames?: Map<string, string>
  onPick: (recent: ClientRecentEntry) => void
}) {
  const kcal = logEntryKcal(recent.entry, foods, recipeFacts)

  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50"
        onClick={() => onPick(recent)}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">
            {clientLogEntryLabel(recent.entry, foods, recipeNames)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatLogAmount(recent.entry)} · {relativeDay(recent.lastDate)}
          </span>
        </span>
        {kcal !== undefined && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{kcal} kcal</span>
        )}
      </button>
    </li>
  )
}

/** "Heute", "Gestern", then the weekday — a date is more than anyone needs here. */
function relativeDay(date: string): string {
  const days = differenceInCalendarDays(parseISO(todayIsoDate()), parseISO(date))
  if (days <= 0) return "Heute"
  if (days === 1) return "Gestern"
  if (days < 7) return format(parseISO(date), "EEEE", { locale: de })
  return format(parseISO(date), "d. MMM", { locale: de })
}
