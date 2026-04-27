"use client"

import type { TooltipProps } from "recharts"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { NutrientChart, type NutrientChartDataPoint } from "@/components/nutrient-chart"
import { formatNumber, formatPercent } from "@/lib/format"

export interface PercentDataPoint {
  name: string
  percent: number
  value: number
  reference: number
  unit: string
}

export interface SimpleEnergyDataPoint {
  name: string
  energie: number
}

export interface ContributionDataPoint extends SimpleEnergyDataPoint {
  share: number
}

export interface MacroPieDataPoint {
  name: string
  value: number
  unit: string
  color: string
}

export interface Co2BySlotDataPoint {
  name: string
  value: number
}

type ChartTooltipProps<TPayload> = TooltipProps<number, string> & {
  label?: string
  payload?: Array<{ payload?: TPayload }>
}

function getStatusColor(percent: number): string {
  if (percent >= 80) return "var(--color-chart-2)"
  if (percent >= 50) return "var(--color-chart-4)"
  return "var(--color-chart-5)"
}

function PercentTooltip({ active, payload, label }: ChartTooltipProps<PercentDataPoint>) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="bg-background rounded-lg border px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      <p className="text-muted-foreground text-sm">
        Istwert: {formatNumber(point.value, 1)} {point.unit}
      </p>
      <p className="text-muted-foreground text-sm">
        Referenz: {formatNumber(point.reference, 1)} {point.unit}
      </p>
      <p className="text-muted-foreground text-sm">
        Abdeckung: {formatPercent(point.percent)}
      </p>
    </div>
  )
}

function MealEnergyTooltip({ active, payload }: ChartTooltipProps<SimpleEnergyDataPoint>) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="bg-background rounded-lg border px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{point.name}</p>
      <p className="text-muted-foreground">{formatNumber(point.energie, 0)} kcal</p>
    </div>
  )
}

function ContributionTooltip({ active, payload }: ChartTooltipProps<ContributionDataPoint>) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="bg-background rounded-lg border px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{point.name}</p>
      <p className="text-muted-foreground">
        {formatNumber(point.energie, 0)} kcal ({formatPercent(point.share)})
      </p>
    </div>
  )
}

function MacroPieTooltip({ active, payload }: ChartTooltipProps<MacroPieDataPoint>) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="bg-background rounded-lg border px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{point.name}</p>
      <p className="text-muted-foreground">
        {formatNumber(point.value, 1)} {point.unit}
      </p>
    </div>
  )
}

export function ReportNutrientChart({ data }: { data: NutrientChartDataPoint[] }) {
  return <NutrientChart data={data} />
}

export function MacroPieChart({ data }: { data: MacroPieDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
        >
          {data.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<MacroPieTooltip />} />
        <Legend layout="vertical" align="right" verticalAlign="middle" />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function MealEnergyChart({ data }: { data: SimpleEnergyDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} unit=" kcal" />
        <Tooltip content={<MealEnergyTooltip />} />
        <Bar dataKey="energie" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function FoodContributionChart({ data }: { data: ContributionDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} unit=" kcal" />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={140} />
        <Tooltip content={<ContributionTooltip />} />
        <Bar dataKey="energie" barSize={16} radius={[0, 4, 4, 0]} fill="var(--color-chart-3)" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PercentCoverageChart({ data }: { data: PercentDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 50)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} unit=" %" />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={75} />
        <Tooltip content={<PercentTooltip />} />
        <Bar dataKey="percent" name="% der Referenz" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={getStatusColor(entry.percent)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Co2BySlotChart({ data }: { data: Co2BySlotDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} unit=" kg" />
        <Tooltip formatter={(value: number) => `${formatNumber(value, 2)} kg`} />
        <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
