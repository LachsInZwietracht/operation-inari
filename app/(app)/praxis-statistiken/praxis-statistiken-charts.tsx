"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatCurrency } from "@/lib/format"

interface AppointmentTimelinePoint {
  iso: string
  label: string
  appointments: number
  patientSlots: number
}

interface AppointmentTypeBreakdownPoint {
  type: string
  termine: number
  patienten: number
}

interface MonthlyRevenuePoint {
  month: string
  sortKey: string
  bezahlt: number
  offen: number
}

interface NamedCountPoint {
  name: string
  count: number
}

interface GenderDistributionPoint {
  name: string
  value: number
}

interface NewPatientsPoint {
  month: string
  sortKey: string
  count: number
}

const GENDER_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]

export function AppointmentTimelineChart({ data }: { data: AppointmentTimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="appointments"
          name="Termine"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="patientSlots"
          name="Patiententermine"
          stroke="hsl(var(--primary) / 0.5)"
          strokeDasharray="4 4"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function AppointmentTypeBreakdownChart({
  data,
}: {
  data: AppointmentTypeBreakdownPoint[]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="type" interval={0} tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="termine" name="Slots" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        <Bar
          dataKey="patienten"
          name="Patiententermine"
          fill="hsl(var(--secondary))"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MonthlyRevenueChart({ data }: { data: MonthlyRevenuePoint[] }) {
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
          name="Offen/Mahnung"
          stackId="revenue"
          fill="hsl(var(--chart-4))"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function GenderDistributionChart({ data }: { data: GenderDistributionPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_entry, index) => (
            <Cell key={index} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function TopIndicationsChart({ data }: { data: NamedCountPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" name="Patienten" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function NewPatientsChart({ data }: { data: NewPatientsPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" name="Neue Patienten" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
