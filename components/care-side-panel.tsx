import Link from "next/link"

import { formatShortDate } from "@/lib/intake-format"
import type {
  AttentionItem,
  DayActivity,
  UpcomingAppointment,
} from "@/lib/care-metrics"
import { cn } from "@/lib/utils"

interface CareSidePanelProps {
  attention: AttentionItem[]
  upcoming: UpcomingAppointment[]
  activity: DayActivity[]
}

/**
 * The right-hand column of the care screen.
 *
 * Three short lists rather than one long one: what has gone wrong, what is
 * coming, and how busy the week was. Everything here is a shortcut into a
 * patient — nothing is only informational.
 */
export function CareSidePanel({ attention, upcoming, activity }: CareSidePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <PanelSection title="Braucht Aufmerksamkeit" count={attention.length}>
        {attention.length === 0 ? (
          <PanelEmpty>Nichts offen.</PanelEmpty>
        ) : (
          attention.slice(0, 8).map((item) => (
            <Link
              key={item.id}
              href={item.href}
              prefetch={false}
              className="flex items-baseline justify-between gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground"
            >
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium">
                  {item.name}
                </span>
                <span
                  className={cn(
                    "block truncate text-[11.5px]",
                    item.tone === "problem"
                      ? "text-[var(--urgency-overdue)]"
                      : "text-[var(--urgency-due)]",
                  )}
                >
                  {item.reason}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-fg-3">
                {item.timing}
              </span>
            </Link>
          ))
        )}
      </PanelSection>

      <PanelSection title="Nächste Termine" count={upcoming.length}>
        {upcoming.length === 0 ? (
          <PanelEmpty>Keine Termine gebucht.</PanelEmpty>
        ) : (
          upcoming.map(({ appointment, patientName }) => (
            <div
              key={appointment.id}
              className="flex items-baseline justify-between gap-2 px-1.5 py-1.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium">
                  {patientName}
                </span>
                <span className="block truncate text-[11.5px] text-fg-3">
                  {appointment.title}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {formatShortDate(appointment.date)}, {appointment.startTime}
              </span>
            </div>
          ))
        )}
      </PanelSection>

      <PanelSection title="Beratungen letzte Woche">
        <WeekActivityBars activity={activity} />
      </PanelSection>
    </div>
  )
}

function PanelSection({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[10px] border bg-panel p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[11px] uppercase tracking-[.1em] text-fg-3">{title}</h2>
        {count === undefined ? null : (
          <span className="font-mono text-[11px] text-fg-4">{count}</span>
        )}
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  )
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-1.5 py-2 text-[12px] text-fg-3">{children}</p>
}

function WeekActivityBars({ activity }: { activity: DayActivity[] }) {
  const peak = Math.max(1, ...activity.map((day) => day.count))

  return (
    <div className="flex items-end justify-between gap-1.5 px-1.5 pt-1">
      {activity.map((day) => (
        <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="font-mono text-[10px] text-fg-4">{day.count || ""}</span>
          <span
            className="w-full rounded-sm"
            style={{
              // A day with no sessions still shows a hairline, so the row reads
              // as seven days rather than a gap.
              height: `${Math.max(2, (day.count / peak) * 44)}px`,
              backgroundColor: day.count ? "var(--urgency-ok)" : "var(--track)",
            }}
            aria-hidden="true"
          />
          <span className="font-mono text-[10px] text-fg-3">{day.initial}</span>
        </div>
      ))}
    </div>
  )
}
