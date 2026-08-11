import type { CareMetric } from "@/lib/care-metrics"
import { cn } from "@/lib/utils"

const TONE_CLASSES: Record<CareMetric["tone"], string> = {
  neutral: "text-fg-3",
  warning: "text-[var(--urgency-due)]",
  problem: "text-[var(--urgency-overdue)]",
}

/**
 * The four headline numbers above the care list.
 *
 * Each carries a comparison line, because a bare number cannot be acted on —
 * "34 aktive Patienten" only means something next to how it moved.
 */
export function CareKpiRow({ metrics }: { metrics: CareMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-[10px] border bg-panel p-3.5">
          <p className="truncate text-[11px] uppercase tracking-[.1em] text-fg-3">
            {metric.label}
          </p>
          <p className="mt-1.5 font-mono text-[26px] font-semibold tracking-[-.02em]">
            {metric.value}
          </p>
          {metric.comparison ? (
            <p className={cn("mt-0.5 truncate text-[11.5px]", TONE_CLASSES[metric.tone])}>
              {metric.comparison}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
