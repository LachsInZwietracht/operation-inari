"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, formatNumber } from "@/lib/format"
import type { AnthropometricEntry } from "@/lib/types"

interface AnthropometricChartProps {
  entries: AnthropometricEntry[]
}

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number
    color?: string
    dataKey?: string
  }>
  label?: string
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background rounded-lg border px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-muted-foreground text-sm">
          <span
            className="mr-2 inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {formatNumber(entry.value ?? 0, 1)}{" "}
          {entry.dataKey === "weight" ? "kg" : ""}
        </p>
      ))}
    </div>
  )
}

export function AnthropometricChart({ entries }: AnthropometricChartProps) {
  const data = entries.map((e) => ({
    date: formatDate(e.date),
    weight: e.weight,
    bmi: e.bmi,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gewichts- und BMI-Verlauf</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="weight" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="bmi" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="weight"
              name="Gewicht (kg)"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="bmi"
              type="monotone"
              dataKey="bmi"
              name="BMI"
              stroke="var(--color-chart-2)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
