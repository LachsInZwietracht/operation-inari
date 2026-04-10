"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  RotateCcw,
  Server,
  Database,
  Activity,
  Zap,
} from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PERFORMANCE_KPIS,
  LOAD_TEST_RESULTS,
  DATABASE_QUERY_STATS,
  SYSTEM_RESOURCES,
  RESPONSE_TIME_HISTORY,
} from "@/lib/mock-data"
import { formatNumber } from "@/lib/format"

const STATUS_COLORS: Record<string, string> = {
  gut: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  warnung: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  kritisch: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

const TREND_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

function resourceUtilizationColor(percent: number): string {
  if (percent < 60) return "bg-emerald-500"
  if (percent < 80) return "bg-amber-500"
  return "bg-red-500"
}

function resourceProgressValue(current: number, max: number): number {
  return Math.round((current / max) * 100)
}

export default function LeistungPage() {
  const [stressUsers, setStressUsers] = useState("100")
  const [stressDuration, setStressDuration] = useState("30")
  const [stressRunning, setStressRunning] = useState(false)
  const [stressProgress, setStressProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopStressTest = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setStressRunning(false)
  }, [])

  function startStressTest() {
    const durationSec = parseInt(stressDuration)
    setStressRunning(true)
    setStressProgress(0)

    const stepMs = 200
    const totalSteps = (durationSec * 1000) / stepMs
    let currentStep = 0

    intervalRef.current = setInterval(() => {
      currentStep++
      const progress = Math.min(Math.round((currentStep / totalSteps) * 100), 100)
      setStressProgress(progress)

      if (currentStep >= totalSteps) {
        stopStressTest()
        setStressProgress(100)
        toast.success("Stresstest abgeschlossen", {
          description: `${stressUsers} gleichzeitige Nutzer über ${durationSec}s simuliert.`,
        })
      }
    }, stepMs)
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leistung & Validierung"
        description="Systemperformance, Lasttests und Datenbankstatistiken überwachen"
      />

      {/* ── KPI Grid ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {PERFORMANCE_KPIS.map((kpi) => {
          const TrendIcon = TREND_ICONS[kpi.trend] ?? Minus
          const isGoodTrend =
            (kpi.trend === "down" && ["ms", "%"].includes(kpi.unit) && kpi.label.includes("zeit")) ||
            (kpi.trend === "down" && kpi.label.includes("Fehler")) ||
            (kpi.trend === "up" && !kpi.label.includes("Fehler") && !kpi.label.includes("zeit"))

          return (
            <Card key={kpi.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  <Badge className={`border-none text-xs ${STATUS_COLORS[kpi.status]}`}>
                    {kpi.status}
                  </Badge>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{formatNumber(kpi.value, kpi.value % 1 !== 0 ? 2 : 0)}</span>
                  <span className="text-sm text-muted-foreground">{kpi.unit}</span>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <TrendIcon className={`h-3.5 w-3.5 ${isGoodTrend ? "text-emerald-500" : kpi.trend === "flat" ? "text-muted-foreground" : "text-amber-500"}`} />
                  <span className="text-xs text-muted-foreground">
                    Ziel: {formatNumber(kpi.target, kpi.target % 1 !== 0 ? 1 : 0)} {kpi.unit}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* ── Left Column ── */}
        <div className="space-y-6">
          {/* Response Time Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-muted-foreground" />
                Antwortzeiten (24h)
              </CardTitle>
              <CardDescription>Durchschnittliche Antwortzeit in Millisekunden</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={RESPONSE_TIME_HISTORY} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="responseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" unit=" ms" />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                      formatter={(value: number) => [`${value} ms`, "Antwortzeit"]}
                    />
                    <ReferenceLine y={100} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: "Ziel 100 ms", position: "right", fontSize: 11, fill: "hsl(var(--destructive))" }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="url(#responseGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Load Test Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-muted-foreground" />
                Lasttest-Ergebnisse
              </CardTitle>
              <CardDescription>Performance unter verschiedenen Lastszenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Szenario</TableHead>
                    <TableHead className="text-right">Nutzer</TableHead>
                    <TableHead className="text-right">Avg (ms)</TableHead>
                    <TableHead className="text-right">P95 (ms)</TableHead>
                    <TableHead className="text-right">P99 (ms)</TableHead>
                    <TableHead className="text-right">Fehler (%)</TableHead>
                    <TableHead className="text-right">Durchsatz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {LOAD_TEST_RESULTS.map((lt) => (
                    <TableRow key={lt.id} className={lt.errorRate > 1 ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{lt.testName}</TableCell>
                      <TableCell className="text-right">{formatNumber(lt.concurrentUsers)}</TableCell>
                      <TableCell className="text-right">{formatNumber(lt.avgResponseMs)}</TableCell>
                      <TableCell className="text-right">{formatNumber(lt.p95ResponseMs)}</TableCell>
                      <TableCell className="text-right">{formatNumber(lt.p99ResponseMs)}</TableCell>
                      <TableCell className="text-right">
                        <span className={lt.errorRate > 0.5 ? "font-medium text-destructive" : ""}>
                          {formatNumber(lt.errorRate, 2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(lt.throughputRps)} req/s</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Stress Test Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Play className="h-5 w-5 text-muted-foreground" />
                Stresstest
              </CardTitle>
              <CardDescription>Simulieren Sie Last auf dem System, um Performance-Grenzen zu erkennen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Gleichzeitige Nutzer</label>
                  <Input
                    type="number"
                    min="1"
                    max="5000"
                    value={stressUsers}
                    onChange={(e) => setStressUsers(e.target.value)}
                    className="w-[140px]"
                    disabled={stressRunning}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Dauer</label>
                  <Select value={stressDuration} onValueChange={setStressDuration} disabled={stressRunning}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 Sekunden</SelectItem>
                      <SelectItem value="30">30 Sekunden</SelectItem>
                      <SelectItem value="60">1 Minute</SelectItem>
                      <SelectItem value="300">5 Minuten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={stressRunning ? stopStressTest : startStressTest}
                  variant={stressRunning ? "destructive" : "default"}
                >
                  {stressRunning ? (
                    <>
                      <RotateCcw className="mr-1.5 h-4 w-4 animate-spin" />
                      Abbrechen
                    </>
                  ) : (
                    <>
                      <Play className="mr-1.5 h-4 w-4" />
                      Starten
                    </>
                  )}
                </Button>
              </div>

              {(stressRunning || stressProgress > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {stressRunning ? "Test läuft…" : stressProgress === 100 ? "Abgeschlossen" : "Bereit"}
                    </span>
                    <span className="font-medium">{stressProgress} %</span>
                  </div>
                  <Progress value={stressProgress} className="h-2" />
                  {stressProgress === 100 && (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg bg-muted/50 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Avg Antwortzeit</p>
                        <p className="text-lg font-bold">87 ms</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Durchsatz</p>
                        <p className="text-lg font-bold">1.180 req/s</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Fehlerrate</p>
                        <p className="text-lg font-bold">0,05 %</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3 text-center">
                        <p className="text-xs text-muted-foreground">P99 Latenz</p>
                        <p className="text-lg font-bold">340 ms</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-6">
          {/* System Resources */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-5 w-5 text-muted-foreground" />
                Systemressourcen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {SYSTEM_RESOURCES.map((res) => {
                const percent = resourceProgressValue(res.currentValue, res.maxValue)
                const colorClass = resourceUtilizationColor(percent)
                return (
                  <div key={res.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{res.label}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(res.currentValue, res.currentValue % 1 !== 0 ? 1 : 0)} / {formatNumber(res.maxValue)} {res.unit}
                      </span>
                    </div>
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all ${colorClass}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">{percent} % Auslastung</p>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Database Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-5 w-5 text-muted-foreground" />
                Datenbankabfragen
              </CardTitle>
              <CardDescription>Top-Abfragen nach Durchschnittszeit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {DATABASE_QUERY_STATS.sort((a, b) => b.avgDurationMs - a.avgDurationMs).map((q) => (
                  <div key={q.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{q.queryName}</p>
                        <p className="text-xs text-muted-foreground">{q.tableName}</p>
                      </div>
                      <span className="text-sm font-bold">{q.avgDurationMs} ms</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatNumber(q.callsPerMinute)} Aufrufe/min</span>
                      <span className="flex items-center gap-1">
                        Cache:
                        <span className={q.cacheHitRate > 85 ? "text-emerald-600 dark:text-emerald-400" : q.cacheHitRate > 60 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                          {formatNumber(q.cacheHitRate, 1)} %
                        </span>
                      </span>
                    </div>
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary/60 transition-all"
                        style={{ width: `${Math.min((q.avgDurationMs / 40) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
