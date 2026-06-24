"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatCurrency } from "@/lib/format"

interface RevenueChartDataPoint {
  month: string
  sortKey: string
  bezahlt: number
  offen: number
}

export function RevenueChart({ data }: { data: RevenueChartDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value: unknown) => formatCurrency(Number(value ?? 0))} />
        <Legend />
        <Bar
          dataKey="bezahlt"
          name="Bezahlt"
          stackId="revenue"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="offen"
          name="Offen"
          stackId="revenue"
          fill="hsl(var(--chart-4))"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
