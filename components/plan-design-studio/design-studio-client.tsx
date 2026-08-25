"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { ConceptAssistent } from "./concept-assistent"
import { ConceptTagesbogen } from "./concept-tagesbogen"
import { ConceptVerlauf } from "./concept-verlauf"
import { SegmentedControl, SYSTEM_FONT } from "./studio-ui"

/**
 * Design studio for the Ernährungsplan-Erstellung.
 *
 * Three Flow drafts, side by side, so the team can pick one before it is built
 * for real. All three run on the shared
 * demo catalogue in `demo-data.ts` — same client, same week, same library — and
 * each keeps its own state, so switching drafts starts the next one fresh.
 *
 * The three drafts differ in what the flow follows: the counselor's decisions,
 * the client's case over time, or the client's own day. None of them drops a
 * function the current planner has.
 */

type ConceptId = "assistent" | "verlauf" | "tagesbogen"

const CONCEPTS: Array<{
  id: ConceptId
  label: string
  headline: string
  idea: string
  points: string[]
}> = [
  {
    id: "assistent",
    label: "1 · Assistent",
    headline: "Der Flow folgt den Entscheidungen",
    idea:
      "Fünf Fragen in der Reihenfolge, in der sie im Termin aufkommen: Wo steht die Klientin, woran wird gemessen, was darf nicht auf den Teller, womit fangen wir an, passt das so. Eine Entscheidung pro Bildschirm, die Konsequenz immer in der Fußleiste.",
    points: [
      "Startet bei der Rückmeldung der Klientin, nicht bei einem leeren Tag",
      "Zielwerte werden erklärt, nicht nur eingetragen",
      "Endet mit der verbindlichen Freigabe eines Standes",
    ],
  },
  {
    id: "verlauf",
    label: "2 · Verlauf",
    headline: "Der Flow folgt dem Fall",
    idea:
      "Links die Chronik der Beratung – Aufnahme, Stand 1, Stand 2, Rückmeldung –, rechts die Station, an der gerade gearbeitet wird. Kein „Weiter“, keine Reihenfolge: Der aktuelle Plan steht immer in der Geschichte, aus der er entstanden ist.",
    points: [
      "Freigegebene Stände bleiben sichtbar und unveränderlich",
      "Die Rückmeldung erzeugt die Aufgaben für den nächsten Stand",
      "Jede Station ist ein Klick entfernt, nichts ist weggeklappt",
    ],
  },
  {
    id: "tagesbogen",
    label: "3 · Tagesbogen",
    headline: "Der Flow folgt dem Tag der Klientin",
    idea:
      "Fünf Mahlzeiten entlang der Uhr, große Schrift, sonst nichts. Bibliothek, Bilanz, Rahmen, Woche und Freigabe kommen als Sheet von unten und verschwinden wieder – gebaut für die Hälfte der Arbeit, die neben der Klientin stattfindet.",
    points: [
      "Tagesplan als Zeitachse von 7:30 bis 19:00 Uhr",
      "„Klientensicht“ blendet jede Zahl aus, die niemand vorlesen will",
      "Alle Werkzeuge in Sheets statt in Spalten",
    ],
  },
]

export function DesignStudioClient() {
  const [concept, setConcept] = useState<ConceptId>("assistent")
  // Remounts the active draft, so "Zurücksetzen" restores the seed week.
  const [resetKey, setResetKey] = useState(0)

  const active = CONCEPTS.find((entry) => entry.id === concept)!

  return (
    <div className="space-y-6">
      <PageHeader
        title="Design-Studio · Ernährungsplan"
        description="Drei Flow-Entwürfe für die Berater-Journey. Alle laufen auf denselben Demo-Daten – nichts wird gespeichert."
        helpText="Die Entwürfe zeigen denselben Funktionsumfang wie der bestehende Planer: Strategie und Zielwerte, Rahmen und Prinzipien, Bibliothek mit Rezepten, Zutaten und Vorlagen, Tages- und Wochenplan, Mengen, Austausch, Mikronährstoffe mit Lückenschluss, Zusatzstoffe, Allergenhinweise, Einkaufsliste, Export sowie die Freigabe unveränderlicher Stände samt Änderungsentwurf. Nur Aufbau und Bedienung unterscheiden sich."
      >
        <Button variant="outline" size="sm" onClick={() => setResetKey((key) => key + 1)}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Zurücksetzen
        </Button>
      </PageHeader>

      {/* Switcher stays reachable while scrolling through a long draft. */}
      <div className="bg-background/85 sticky top-0 z-40 -mx-4 space-y-3 px-4 py-3 backdrop-blur-xl md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            value={concept}
            onValueChange={setConcept}
            options={CONCEPTS.map((entry) => ({ value: entry.id, label: entry.label }))}
            className="max-w-full overflow-x-auto"
          />
          <span className="text-muted-foreground rounded-full border border-dashed px-3 py-1 text-xs">
            Demo-Daten · Anna Berger (fiktiv)
          </span>
        </div>

        <div style={{ fontFamily: SYSTEM_FONT }} className="min-w-0">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">{active.headline}</p>
          <p className="text-muted-foreground mt-0.5 max-w-[90ch] text-[13px]">{active.idea}</p>
          <ul className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            {active.points.map((point) => (
              <li key={point} className="before:mr-1.5 before:content-['·']">
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div key={`${concept}-${resetKey}`} className="pt-1">
        {concept === "assistent" && <ConceptAssistent />}
        {concept === "verlauf" && <ConceptVerlauf />}
        {concept === "tagesbogen" && <ConceptTagesbogen />}
      </div>
    </div>
  )
}
