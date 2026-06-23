"use client"

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis } from "recharts"

import { formatCurrency } from "@/lib/format"

interface RevenueTrendPoint {
  month: string
  revenue: number
  outstanding: number
}

export function RevenueTrendChart({ data }: { data: RevenueTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="month" interval={0} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value: unknown) => formatCurrency(Number(value ?? 0))} />
        <Legend />
        <Bar dataKey="revenue" name="Bezahlt" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="outstanding" name="Offen" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
