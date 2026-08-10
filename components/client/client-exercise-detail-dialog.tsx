"use client"

import { useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Trophy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  buildExerciseHistory,
  findPersonalRecords,
  formatSet,
  formatSetRun,
  summarizeExerciseProgress,
} from "@/lib/client-training"
import type { ClientProgressMetric, ClientWorkoutSession } from "@/lib/types"

const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "var(--color-muted-foreground)" },
} as const

/**
 * Strength is a level, not a quantity, and levels move in narrow bands: an
 * eight-kilo gain plotted from zero is a flat line. Lines carry no area, so
 * they carry no obligation to a zero baseline — pad the observed range instead.
 */
const PADDED_DOMAIN = [
  (min: number) => Math.max(0, Math.floor(min - Math.max(2, Math.abs(min) * 0.08))),
  (max: number) => Math.ceil(max + Math.max(2, Math.abs(max) * 0.08)),
] as const

const METRICS: Record<ClientProgressMetric, { label: string; unit: string; hint: string }> = {
  oneRepMax: {
    label: "1RM",
    unit: "kg",
    hint: "Geschätztes Einer-Maximum. Rechnet Wiederholungen und Gewicht auf eine Zahl um.",
  },
  volume: {
    label: "Volumen",
    unit: "kg",
    hint: "Summe aus Wiederholungen × Gewicht. Steigt auch, wenn du nur mehr Sätze machst.",
  },
  weight: { label: "Gewicht", unit: "kg", hint: "Schwerster Satz der Woche." },
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: { value?: number }[]
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-sm tabular-nums text-muted-foreground">
        {payload[0]?.value ?? 0} {unit}
      </p>
    </div>
  )
}

/**
 * Everything recorded for one exercise.
 *
 * The list view can only show the last few weeks of every exercise at once;
 * this is where a single exercise gets the whole record, and where the choice
 * of progress measure lives — "did I get stronger" (1RM) and "did I do more
 * work" (volume) are different questions and neither one answers the other.
 */
export function ClientExerciseDetailDialog({
  exerciseName,
  sessions,
  onClose,
}: {
  exerciseName: string
  sessions: ClientWorkoutSession[]
  onClose: () => void
}) {
  const [metric, setMetric] = useState<ClientProgressMetric>("oneRepMax")

  const points = useMemo(() => {
    const key = exerciseName.trim().toLowerCase()
    return (
      summarizeExerciseProgress(sessions).find(
        (exercise) => exercise.exerciseName.trim().toLowerCase() === key,
      )?.points ?? []
    )
  }, [sessions, exerciseName])

  const history = useMemo(
    () => buildExerciseHistory(sessions, exerciseName),
    [sessions, exerciseName],
  )
  const record = useMemo(
    () => findPersonalRecords(sessions).get(exerciseName.trim().toLowerCase()),
    [sessions, exerciseName],
  )

  // Bodyweight work has no weight to plot, so it gets a reps line and no
  // choice of measure — offering "Volumen: 0 kg" would be a worse answer than
  // not offering it.
  const hasWeights = points.some((point) => point.bestWeightKg !== undefined)

  const chartData = points.map((point) => ({
    label: `KW ${format(parseISO(point.weekStart), "I", { locale: de })}`,
    value: hasWeights
      ? metric === "oneRepMax"
        ? point.bestOneRepMaxKg
        : metric === "volume"
          ? point.volumeKg
          : point.bestWeightKg
      : point.bestReps,
  }))
  const unit = hasWeights ? METRICS[metric].unit : "Wdh."
  const totalSets = points.reduce((sum, point) => sum + point.totalSets, 0)

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-h-[85svh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{exerciseName}</DialogTitle>
          <DialogDescription>
            {totalSets} {totalSets === 1 ? "Satz" : "Sätze"} in {history.length}{" "}
            {history.length === 1 ? "Einheit" : "Einheiten"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {record && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <Trophy className="h-4 w-4 text-primary" />
              <div className="text-sm">
                <span className="font-medium tabular-nums">
                  {formatSet(record.reps, record.weightKg)}
                </span>
                <span className="text-muted-foreground">
                  {" · "}
                  {format(parseISO(record.date), "d. MMM yyyy", { locale: de })}
                </span>
              </div>
              <Badge variant="secondary" className="ml-auto tabular-nums">
                {record.oneRepMaxKg} kg 1RM
              </Badge>
            </div>
          )}

          {hasWeights && (
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={metric}
              onValueChange={(next) => {
                if (next) setMetric(next as ClientProgressMetric)
              }}
              className="justify-start"
            >
              {(Object.keys(METRICS) as ClientProgressMetric[]).map((id) => (
                <ToggleGroupItem key={id} value={id} aria-label={METRICS[id].label}>
                  {METRICS[id].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}

          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
                <XAxis dataKey="label" {...AXIS_PROPS} />
                <YAxis width={56} domain={[...PADDED_DOMAIN]} {...AXIS_PROPS} />
                <Tooltip content={<ChartTooltip unit={unit} />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={hasWeights ? METRICS[metric].label : "Wiederholungen"}
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  // Named fill: recharts defaults a Line's dots to white, which
                  // on a light card leaves a single-point series invisible.
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: "var(--color-card)",
                    fill: "var(--color-chart-1)",
                  }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ab der zweiten Trainingswoche zeichnet sich hier eine Kurve ab.
            </p>
          )}

          {hasWeights && <p className="text-xs text-muted-foreground">{METRICS[metric].hint}</p>}

          <ScrollArea className="max-h-56">
            <ul className="space-y-2 pr-3">
              {history.map((entry) => (
                <li key={entry.sessionId} className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(entry.date), "d. MMM yyyy", { locale: de })}
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    {formatSetRun(entry.sets)}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
