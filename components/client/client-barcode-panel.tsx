"use client"

import { useState } from "react"
import { Loader2, ScanBarcode } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { lookupBarcode } from "@/lib/data/barcode-client"
import type { NutrientValue } from "@/lib/types"

/** Only what the diary needs; the panel never persists anything itself. */
export interface BarcodeCustomPick {
  name: string
  nutrients: NutrientValue[]
}

type PanelState =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "unknown"; barcode: string }
  | { kind: "invalid"; reason: "format" | "check_digit" | "implausible" }
  | { kind: "failed" }

const INVALID_MESSAGES: Record<"format" | "check_digit" | "implausible", string> = {
  format: "Das sieht nicht nach einem Barcode aus. Ein EAN hat 8 oder 13 Ziffern.",
  check_digit: "Die Prüfziffer passt nicht — vermutlich vertippt.",
  implausible: "Dieser Code gehört zu keinem Lebensmittel.",
}

function parseAmount(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

/**
 * Barcode entry for the food diary.
 *
 * Typed codes only for now — the camera layer plugs in above this, and keeping
 * the manual field permanently means a denied camera permission is an
 * inconvenience rather than a dead end.
 */
export function ClientBarcodePanel({
  onPickCatalogFood,
  onPickCustom,
}: {
  onPickCatalogFood: (food: { id: string; name: string }) => void
  onPickCustom: (product: BarcodeCustomPick) => void
}) {
  const [code, setCode] = useState("")
  const [state, setState] = useState<PanelState>({ kind: "idle" })

  async function handleLookup() {
    const trimmed = code.trim()
    if (!trimmed) return

    setState({ kind: "searching" })
    try {
      const result = await lookupBarcode(trimmed)

      switch (result.status) {
        case "catalog":
          onPickCatalogFood(result.food)
          return
        case "external":
          onPickCustom({
            name: result.product.brand
              ? `${result.product.name} (${result.product.brand})`
              : result.product.name,
            nutrients: result.product.nutrients,
          })
          return
        case "unknown":
          setState({ kind: "unknown", barcode: result.barcode })
          return
        case "invalid":
          setState({ kind: "invalid", reason: result.reason })
          return
      }
    } catch (error) {
      console.error("Barcode lookup failed:", error)
      setState({ kind: "failed" })
    }
  }

  if (state.kind === "unknown") {
    return (
      <ManualProductForm
        barcode={state.barcode}
        onCancel={() => setState({ kind: "idle" })}
        onSubmit={onPickCustom}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="client-barcode">Barcode</Label>
        <div className="flex gap-2">
          <Input
            id="client-barcode"
            autoFocus
            inputMode="numeric"
            placeholder="z. B. 4008400401027"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              if (state.kind !== "idle") setState({ kind: "idle" })
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void handleLookup()
              }
            }}
          />
          <Button
            type="button"
            disabled={state.kind === "searching" || !code.trim()}
            onClick={() => void handleLookup()}
          >
            {state.kind === "searching" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanBarcode className="h-4 w-4" />
            )}
            <span className="ml-2">Suchen</span>
          </Button>
        </div>
      </div>

      {state.kind === "invalid" && (
        <p className="text-sm text-destructive">{INVALID_MESSAGES[state.reason]}</p>
      )}
      {state.kind === "failed" && (
        <p className="text-sm text-destructive">
          Die Suche hat nicht geklappt. Versuch es gleich noch einmal.
        </p>
      )}
    </div>
  )
}

/**
 * Last resort when neither the catalog nor Open Food Facts knows the product.
 *
 * It produces exactly the same `custom` entry as an Open Food Facts hit, so
 * nothing downstream — nutrient math, the counselor's view — has to know which
 * of the two it was. Energy is the only required field: a diary entry that
 * cannot be counted is worse than no entry, but demanding all macros would
 * send people back to the packaging for numbers they may not care about.
 */
function ManualProductForm({
  barcode,
  onCancel,
  onSubmit,
}: {
  barcode: string
  onCancel: () => void
  onSubmit: (product: BarcodeCustomPick) => void
}) {
  const [name, setName] = useState("")
  const [energy, setEnergy] = useState("")
  const [protein, setProtein] = useState("")
  const [fat, setFat] = useState("")
  const [carbs, setCarbs] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    const trimmedName = name.trim()
    const kcal = parseAmount(energy)
    if (!trimmedName || kcal === undefined) {
      setError("Name und Kalorien je 100 g werden gebraucht.")
      return
    }

    const nutrients: NutrientValue[] = [{ nutrientId: "energie", amount: kcal }]
    for (const [nutrientId, raw] of [
      ["eiweiss", protein],
      ["fett", fat],
      ["kohlenhydrate", carbs],
    ] as const) {
      const value = parseAmount(raw)
      if (raw.trim() && value !== undefined) nutrients.push({ nutrientId, amount: value })
    }

    onSubmit({ name: trimmedName, nutrients })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-dashed p-3">
        <p className="text-sm font-medium">Produkt unbekannt</p>
        <p className="text-xs text-muted-foreground">
          Weder unser Katalog noch Open Food Facts kennen{" "}
          <span className="font-mono">{barcode}</span>. Trag die Werte von der Verpackung ein.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-name">Name</Label>
        <Input
          id="manual-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="manual-energy">kcal je 100 g</Label>
          <Input
            id="manual-energy"
            inputMode="decimal"
            value={energy}
            onChange={(event) => setEnergy(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-protein">Eiweiß (g)</Label>
          <Input
            id="manual-protein"
            inputMode="decimal"
            value={protein}
            onChange={(event) => setProtein(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-fat">Fett (g)</Label>
          <Input
            id="manual-fat"
            inputMode="decimal"
            value={fat}
            onChange={(event) => setFat(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-carbs">Kohlenhydrate (g)</Label>
          <Input
            id="manual-carbs"
            inputMode="decimal"
            value={carbs}
            onChange={(event) => setCarbs(event.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Zurück
        </Button>
        <Button type="button" size="sm" onClick={handleSubmit}>
          Übernehmen
        </Button>
      </div>
    </div>
  )
}
