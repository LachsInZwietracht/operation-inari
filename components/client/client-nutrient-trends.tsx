"use client"

import { useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  formatMicroAmount,
  trendLimits,
  trendsByShortfall,
  type ClientNutrientTrend,
} from "@/lib/client-micronutrients"
import { cn } from "@/lib/utils"

/** As many as the day panel opens with — the same handful, the same order. */
const FOCUS_COUNT = 6

/**
 * Micronutrients over the window, as averages rather than streaks.
 *
 * The framing is deliberate and is the opposite of what a habit tracker would
 * do. Reference intakes are defined as averages over days; one portion of
 * liver is ten days of vitamin A. "You hit iron on 4 of 14 days" would be both
 * factually wrong and discouraging, so the headline is the average against the
 * reference and the daily values live one tap down, as context for it.
 *
 * Tapping a row drops its chart in underneath rather than opening a dialog:
 * the ranking is the reason someone is here, and a modal would hide it.
 */
export function ClientNutrientTrends({
  trends,
  windowDays,
}: {
  trends: ClientNutrientTrend[]
  windowDays: number
}) {
  const [showAll, setShowAll] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  if (trends.length === 0) return null

  const goals = trendsByShortfall(trends)
  const limits = trendLimits(trends)
  const visible = showAll ? goals : goals.slice(0, FOCUS_COUNT)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Mikronährstoffe</CardTitle>
        <CardDescription>
          Durchschnitt der letzten {windowDays} Tage. Referenzwerte gelten im Mittel über
          mehrere Tage — ein einzelner Tag muss sie nicht treffen.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1">
          {visible.map((trend) => (
            <TrendRow
              key={trend.nutrientId}
              trend={trend}
              isOpen={openId === trend.nutrientId}
              onToggle={() =>
                setOpenId((current) => (current === trend.nutrientId ? null : trend.nutrientId))
              }
            />
          ))}
        </div>

        {goals.length > FOCUS_COUNT && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => setShowAll((all) => !all)}
          >
            {showAll ? "Weniger anzeigen" : "Alle anzeigen"}
          </Button>
        )}

        {limits.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            {/* A separate question, and never a bar: these are ceilings. */}
            <p className="text-xs text-muted-foreground">Obergrenzen</p>
            {limits.map((trend) => (
              <TrendRow
                key={trend.nutrientId}
                trend={trend}
                isOpen={openId === trend.nutrientId}
                onToggle={() =>
                  setOpenId((current) => (current === trend.nutrientId ? null : trend.nutrientId))
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TrendRow({
  trend,
  isOpen,
  onToggle,
}: {
  trend: ClientNutrientTrend
  isOpen: boolean
  onToggle: () => void
}) {
  // Days that carried too little data were left out of the average rather than
  // counted as low ones. Where that changes the number, it is said out loud.
  const isPartial = trend.daysCounted < trend.daysLogged

  return (
    <div>
      <button
        type="button"
        className="w-full space-y-1 rounded-sm py-1 text-left"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate">{trend.label}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                isOpen && "rotate-180",
              )}
              aria-hidden
            />
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            Ø {formatMicroAmount(trend.average, trend.unit)} /{" "}
            {formatMicroAmount(trend.target, trend.unit)}
            {trend.kind === "limit" && <span className="ml-1">max.</span>}
          </span>
        </div>

        {trend.kind === "reach" && (
          <div
            className="h-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={trend.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${trend.label}: ${trend.percent} %`}
          >
            <div
              className="h-full rounded-full bg-muted-foreground/60 transition-all"
              style={{ width: `${trend.percent}%` }}
            />
          </div>
        )}
      </button>

      {isOpen && <TrendChart trend={trend} isPartial={isPartial} />}
    </div>
  )
}

function TrendChart({ trend, isPartial }: { trend: ClientNutrientTrend; isPartial: boolean }) {
  const data = trend.points.map((point) => ({
    label: format(parseISO(point.date), "d.M.", { locale: de }),
    // Absent rather than zero, so a day with no usable data leaves a gap
    // instead of drawing a bar that claims none of this was eaten.
    wert: point.value,
    // The two invisible cases have to be told apart: a genuine zero and a day
    // the database could not describe both draw no bar, and the whole point of
    // this view is that those are not the same statement. Unknown days get a
    // hatched band behind them; a zero day stays empty.
    unbekannt: point.value === undefined,
  }))

  const unknownLabels = data.filter((row) => row.unbekannt).map((row) => row.label)

  return (
    <div className="space-y-2 pb-2 pt-1">
      <ResponsiveContainer width="100%" height={150}>
        {/* Right margin leaves room for the reference line's label. */}
        <BarChart data={data} margin={{ top: 8, right: 28, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
          <XAxis dataKey="label" interval="preserveStartEnd" {...AXIS_PROPS} />
          {/* The target is part of the scale, not an afterthought: without it
              in the domain the reference line can sit off the top of a chart
              whose bars never come close, which is exactly the case that needs
              it most. */}
          <YAxis
            domain={[0, (max: number) => niceCeiling(Math.max(max, trend.target) * 1.1)]}
            {...AXIS_PROPS}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
            content={<TrendTooltip unit={trend.unit} />}
          />

          {unknownLabels.map((label) => (
            <ReferenceArea
              key={label}
              x1={label}
              x2={label}
              fill="var(--color-muted-foreground)"
              fillOpacity={0.12}
              ifOverflow="extendDomain"
            />
          ))}

          {/* The reference itself, so the bars are read against something. */}
          <ReferenceLine
            y={trend.target}
            stroke="var(--color-muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: "Ziel",
              position: "right",
              fontSize: 11,
              fill: "var(--color-muted-foreground)",
            }}
          />
          {/* One series, so the card title is the legend. */}
          <Bar
            dataKey="wert"
            name={trend.label}
            fill="var(--color-chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground">
        Ø aus {trend.daysCounted} von {trend.daysLogged}{" "}
        {trend.daysLogged === 1 ? "eingetragenem Tag" : "eingetragenen Tagen"}
        {isPartial
          ? " — graue Tage haben zu wenige Nährstoffangaben und zählen nicht mit, statt den Schnitt zu drücken."
          : ". Ein leerer Tag heißt: davon nichts gegessen."}
      </p>
    </div>
  )
}

/**
 * Rounds an axis maximum up to the next readable number.
 *
 * Left raw, a domain of 26 gives recharts ticks of 6.5 and 19.5, whose rounded
 * labels read as an arithmetic mistake. The ladder is deliberately fine —
 * jumping 25 straight to 50 would round the axis at the cost of throwing away
 * half the plot height. Nutrients span micrograms to grams, so the step is
 * derived from the magnitude rather than hard-coded.
 */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
}

const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "var(--color-muted-foreground)" },
} as const

function TrendTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: { value?: number }[]
  label?: string
  unit: string
}) {
  const value = payload?.[0]?.value
  if (!active || value === undefined) return null

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      <p className="text-sm tabular-nums text-muted-foreground">
        {formatMicroAmount(value, unit)}
      </p>
    </div>
  )
}
