"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CLIENT_TRAINING_WEEKS, type ClientTrainingWeek } from "@/lib/client-stats"
import { formatSet } from "@/lib/client-training"
import type { ClientPersonalRecord } from "@/lib/types"

const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: "var(--color-muted-foreground)" },
} as const

/** Same fixed order as the rest of the client charts; violet stays skipped. */
const SERIES_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-5)"]

/** More than this and the record list stops being a highlight. */
const MAX_RECORDS = 4

interface TooltipEntry {
  name?: string
  value?: number
  color?: string
  dataKey?: string | number
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="text-sm text-muted-foreground">
          <span
            className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {entry.value ?? 0}
        </p>
      ))}
    </div>
  )
}

/**
 * Training by the week.
 *
 * A day is the wrong grain: nobody trains daily, so a daily chart is mostly
 * zeros and reads as failure where the truth is "three times a week, as
 * planned". Volume sits beside the session count because they answer different
 * questions — showing up, and doing more once you are there.
 */
export function ClientTrainingSummary({
  weeks,
  records,
}: {
  weeks: ClientTrainingWeek[]
  records: ClientPersonalRecord[]
}) {
  const data = weeks.map((week) => ({
    label: `KW ${format(parseISO(week.weekStart), "I", { locale: de })}`,
    Einheiten: week.sessions,
    Minuten: week.minutes,
    volumeKg: week.volumeKg,
    kcal: week.kcal,
  }))

  const totalSessions = weeks.reduce((sum, week) => sum + week.sessions, 0)
  const totalMinutes = weeks.reduce((sum, week) => sum + week.minutes, 0)
  const totalKcal = weeks.reduce((sum, week) => sum + week.kcal, 0)
  const hasVolume = weeks.some((week) => week.volumeKg > 0)
  const recentRecords = records.slice(0, MAX_RECORDS)

  if (totalSessions === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Einheiten je Woche</CardTitle>
          <CardDescription>
            Sobald du eine Einheit erfasst, entsteht hier dein Wochenrhythmus.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Einheiten je Woche</CardTitle>
          <CardDescription>
            Letzte {CLIENT_TRAINING_WEEKS} Wochen · {totalSessions}{" "}
            {totalSessions === 1 ? "Einheit" : "Einheiten"}
            {totalMinutes > 0 && ` · ${Math.round(totalMinutes / 60)} h`}
            {totalKcal > 0 && ` · ≈ ${totalKcal} kcal`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
              <XAxis dataKey="label" interval="preserveStartEnd" {...AXIS_PROPS} />
              <YAxis allowDecimals={false} {...AXIS_PROPS} />
              <Tooltip
                cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
                content={<ChartTooltip />}
              />
              <Bar
                dataKey="Einheiten"
                fill={SERIES_COLORS[0]}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {hasVolume && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Volumen je Woche</CardTitle>
            <CardDescription>
              Summe aus Wiederholungen × Gewicht über alle Übungen. Steigt auch, wenn du nur
              mehr Sätze machst.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
                <XAxis dataKey="label" interval="preserveStartEnd" {...AXIS_PROPS} />
                <YAxis unit=" kg" width={64} {...AXIS_PROPS} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)", fillOpacity: 0.4 }}
                  content={<ChartTooltip />}
                />
                {/* One series, and the card title already names it — a legend
                    here would only repeat the heading. */}
                <Bar
                  dataKey="volumeKg"
                  name="Volumen"
                  fill={SERIES_COLORS[1]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {recentRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Bestleistungen
            </CardTitle>
            <CardDescription>Dein stärkster Satz je Übung, zuletzt erreicht zuerst.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {recentRecords.map((record) => (
                <li
                  key={record.setId}
                  className="flex items-center gap-3 px-6 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {record.exerciseName}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatSet(record.reps, record.weightKg)}
                  </span>
                  <Badge variant="secondary" className="tabular-nums">
                    {record.oneRepMaxKg} kg
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}
