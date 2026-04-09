"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { formatNumber } from "@/lib/format"

export interface NutrientChartDataPoint {
  name: string
  value: number
  reference: number
  unit: string
}

interface NutrientChartProps {
  data: NutrientChartDataPoint[]
  horizontal?: boolean
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number
    color?: string
    payload?: NutrientChartDataPoint
  }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const unit = payload[0]?.payload?.unit ?? ""

  return (
    <div className="bg-background rounded-lg border px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-muted-foreground text-sm">
          <span
            className="mr-2 inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {formatNumber(entry.value ?? 0, 1)} {unit}
        </p>
      ))}
    </div>
  )
}

export function NutrientChart({ data, horizontal = false }: NutrientChartProps) {
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(300, data.length * 50)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 12 }}
            width={75}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            dataKey="value"
            name="Istwert"
            fill="var(--color-chart-1)"
            radius={[0, 4, 4, 0]}
            barSize={16}
          />
          <Bar
            dataKey="reference"
            name="Referenzwert"
            fill="var(--color-chart-3)"
            opacity={0.45}
            radius={[0, 4, 4, 0]}
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar
          dataKey="value"
          name="Istwert"
          fill="var(--color-chart-1)"
          radius={[4, 4, 0, 0]}
          barSize={28}
        />
        <Bar
          dataKey="reference"
          name="Referenzwert"
          fill="var(--color-chart-3)"
          opacity={0.45}
          radius={[4, 4, 0, 0]}
          barSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
