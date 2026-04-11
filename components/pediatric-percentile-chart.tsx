"use client"

import { useMemo, useState } from "react"
import { differenceInMonths, parseISO } from "date-fns"
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { GROWTH_PERCENTILES } from "@/lib/mock-data"
import type { AnthropometricEntry, Gender } from "@/lib/types"

const METRICS = [
  { id: "bmi", label: "BMI" },
  { id: "weight", label: "Gewicht" },
  { id: "height", label: "Größe" },
] as const

const PERCENTILE_KEYS = ["p3", "p10", "p25", "p50", "p75", "p90", "p97"] as const
const PERCENTILE_COLORS: Record<(typeof PERCENTILE_KEYS)[number], string> = {
  p3: "#94a3b8",
  p10: "#6b7280",
  p25: "#4b5563",
  p50: "#2563eb",
  p75: "#047857",
  p90: "#f97316",
  p97: "#dc2626",
}

interface PediatricPercentileChartProps {
  entries: AnthropometricEntry[]
  gender: Gender
  birthDate: string
}

export function PediatricPercentileChart({ entries, gender, birthDate }: PediatricPercentileChartProps) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["id"]>("bmi")
  const birth = parseISO(birthDate)

  const percentileData = useMemo(() => {
    return GROWTH_PERCENTILES.map((row) => {
      const dataset = row[gender === "m" ? "male" : "female"][metric]
      const ageYears = row.ageMonths / 12
      return {
        x: ageYears,
        label: `${ageYears.toFixed(0)} J`,
        ...dataset,
      }
    })
  }, [gender, metric])

  const patientSeries = useMemo(() => {
    return entries.map((entry) => {
      const months = Math.max(0, differenceInMonths(parseISO(entry.date), birth))
      const ageYears = months / 12
      let value = entry.bmi
      if (metric === "weight") value = entry.weight
      if (metric === "height") value = entry.height
      return {
        x: Number(ageYears.toFixed(2)),
        y: Number(value.toFixed(1)),
      }
    })
  }, [birth, entries, metric])

  const metricLabel = METRICS.find((item) => item.id === metric)?.label ?? ""
  const valueUnit = metric === "height" ? "cm" : metric === "weight" ? "kg" : ""

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Pädiatrische Perzentile</CardTitle>
        <ToggleGroup
          type="single"
          value={metric}
          onValueChange={(value) => value && setMetric(value as typeof metric)}
        >
          {METRICS.map((option) => (
            <ToggleGroupItem key={option.id} value={option.id}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={percentileData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              tickFormatter={(value) => `${value} J`}
              tick={{ fontSize: 12 }}
              domain={[0, 18]}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{ value: metricLabel, angle: -90, position: "insideLeft", offset: -5 }}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "Patient") return [`${value.toFixed(1)} ${valueUnit}`, "Patient"]
                return [`${Number(value).toFixed(1)} ${valueUnit}`, name]
              }}
              labelFormatter={(value: number) => `${value.toFixed(1)} Jahre`}
            />
            <Legend />
            {PERCENTILE_KEYS.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={PERCENTILE_COLORS[key]}
                strokeWidth={key === "p50" ? 2 : 1}
                dot={false}
                name={`P${key.slice(1)}`}
              />
            ))}
            <Scatter
              data={patientSeries}
              name="Patient"
              fill="#0f172a"
              line={{ strokeDasharray: "4 2", stroke: "#0f172a" }}
              shape="circle"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-muted-foreground">
          Grafische Orientierung basierend auf WHO/RKI Referenzkurven. Patientendaten werden als Punkte dargestellt.
        </p>
      </CardContent>
    </Card>
  )
}
