"use client"

import { useCallback, useMemo, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  CLIENT_METRICS,
  CLIENT_METRIC_GROUP_LABELS,
  clientMetricPreference,
  type ClientMetric,
  type ClientMetricGroup,
  type ClientMetricPreference,
  type ClientMetricPreferences,
} from "@/lib/client-metrics"
import { saveClientMetricPreference } from "@/lib/data/client-checkin-client"

/**
 * Who decides what is recorded, seen and shared: the client, here, and nobody
 * else.
 *
 * The three switches are not variations of one idea. `tracken` is about
 * effort — every field in the check-in costs a second a day, and a field that
 * is irrelevant to someone costs it forever. `anzeigen` is about attention.
 * `teilen` is about a different thing entirely: it narrows what a counselor
 * sees within an area the client already consented to, and it is the switch
 * that makes a mood score enterable at all. It can never widen that consent —
 * with the consent off, nothing is shared no matter how these stand.
 *
 * Switching `tracken` off hides a field and keeps every value already given.
 * Deleting data is a different, explicit act, and quietly doing it inside a
 * preference toggle would be the wrong kind of helpful.
 */

const GROUP_ORDER: ClientMetricGroup[] = ["befinden", "ernaehrung", "training", "koerper"]

export function ClientMetricSettings({
  preferences,
  canShare,
  shareHint,
}: {
  preferences: ClientMetricPreferences
  /** False when there is no active link, or the consent for it is off. */
  canShare: boolean
  shareHint: string
}) {
  const [local, setLocal] = useState<ClientMetricPreferences>(preferences)

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      metrics: CLIENT_METRICS.filter((metric) => metric.group === group),
    })).filter((entry) => entry.metrics.length > 0)
  }, [])

  const update = useCallback(
    async (metric: ClientMetric, patch: Partial<ClientMetricPreference>) => {
      const current = clientMetricPreference(local, metric.key)
      const next = { ...current, ...patch }

      // Optimistic: a switch that waits for a round trip feels broken, and the
      // worst case is one toggle that has to be flipped again.
      setLocal((previous) => new Map(previous).set(metric.key, next))

      try {
        await saveClientMetricPreference(metric.key, next)
      } catch (error) {
        console.error("Failed to save metric preference:", error)
        setLocal((previous) => new Map(previous).set(metric.key, current))
      }
    },
    [local],
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Was du festhältst</CardTitle>
        <CardDescription>
          Du entscheidest, welche Felder im Tagebuch erscheinen, was im Verlauf gezeigt wird und
          was deine Beratung sehen darf.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!canShare && <p className="text-xs text-muted-foreground">{shareHint}</p>}

        {grouped.map(({ group, metrics }) => (
          <section key={group} className="space-y-2">
            <div className="flex items-end justify-between gap-2 border-b pb-1">
              <h3 className="text-sm font-medium">{CLIENT_METRIC_GROUP_LABELS[group]}</h3>
              <div className="flex shrink-0 gap-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className="w-12 text-center">tracken</span>
                <span className="w-12 text-center">anzeigen</span>
                <span className="w-12 text-center">teilen</span>
              </div>
            </div>

            {metrics.map((metric) => (
              <MetricRow
                key={metric.key}
                metric={metric}
                preference={clientMetricPreference(local, metric.key)}
                canShare={canShare}
                onChange={(patch) => void update(metric, patch)}
              />
            ))}
          </section>
        ))}
      </CardContent>
    </Card>
  )
}

function MetricRow({
  metric,
  preference,
  canShare,
  onChange,
}: {
  metric: ClientMetric
  preference: ClientMetricPreference
  canShare: boolean
  onChange: (patch: Partial<ClientMetricPreference>) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="min-w-0">
        <p className="truncate text-sm">{metric.label}</p>
        {metric.mandatory && (
          <p className="text-[11px] text-muted-foreground">immer im Tagebuch</p>
        )}
        {!metric.selfReported && (
          <p className="text-[11px] text-muted-foreground">
            {metric.source === "anthropometrics" ? "aus deinen Wiegungen" : null}
            {metric.source === "foodlog" ? "aus deinem Tagebuch" : null}
            {metric.source === "workout" ? "aus deiner Aktivität" : null}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <SwitchCell
          label={`${metric.label} tracken`}
          // A derived number cannot be untracked: it is computed from data the
          // client already entered somewhere else.
          hidden={!metric.selfReported}
          disabled={metric.mandatory}
          checked={preference.tracked}
          onChange={(tracked) => onChange({ tracked })}
        />
        <SwitchCell
          label={`${metric.label} anzeigen`}
          checked={preference.shown}
          onChange={(shown) => onChange({ shown })}
        />
        <SwitchCell
          label={`${metric.label} teilen`}
          disabled={!canShare}
          checked={preference.shared}
          onChange={(shared) => onChange({ shared })}
        />
      </div>
    </div>
  )
}

function SwitchCell({
  label,
  checked,
  onChange,
  disabled,
  hidden,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  hidden?: boolean
}) {
  return (
    <div className={cn("flex w-12 justify-center")}>
      {hidden ? (
        <span className="text-xs text-muted-foreground" aria-hidden>
          –
        </span>
      ) : (
        <Switch
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      )}
    </div>
  )
}
