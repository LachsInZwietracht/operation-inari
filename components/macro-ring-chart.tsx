"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts"
import type { NutrientValue } from "@/lib/types"
import { getNutrientValue } from "@/lib/nutrients"
import { formatNumber } from "@/lib/format"

interface MacroRingChartProps {
  nutrients: NutrientValue[]
}

const MACROS = [
  { nutrientId: "eiweiss", label: "Eiweiß", color: "var(--chart-1)" },
  { nutrientId: "fett", label: "Fett", color: "var(--chart-2)" },
  { nutrientId: "kohlenhydrate", label: "Kohlenhydrate", color: "var(--chart-3)" },
] as const

export function MacroRingChart({ nutrients }: MacroRingChartProps) {
  const data = MACROS.map((macro) => {
    const grams = getNutrientValue(nutrients, macro.nutrientId)
    return {
      name: macro.label,
      value: Math.round(grams * 10) / 10,
      color: macro.color,
    }
  })

  const totalGrams = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="flex flex-col items-center gap-4">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            formatter={(value: string, entry) => {
              const payload = entry.payload as (typeof data)[number] | undefined
              if (!payload) return value
              const pct = totalGrams > 0 ? (payload.value / totalGrams) * 100 : 0
              return `${value}: ${formatNumber(payload.value, 1)} g (${formatNumber(pct, 0)} %)`
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
