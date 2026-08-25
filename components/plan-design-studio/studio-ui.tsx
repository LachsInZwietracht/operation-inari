"use client"

import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"
import type { TargetReading, TargetStatus } from "./demo-data"

/**
 * Shared atoms for the three Ernährungsplan design drafts.
 *
 * Only the pieces Apple itself uses identically everywhere live here — the
 * segmented control, the progress ring, the target bar. Everything that gives
 * a draft its character stays in that draft's own file.
 */

/**
 * The system typeface, so the drafts read the way they would on the reviewer's
 * own Mac. Falls back to the app's Geist on Windows and Linux rather than to
 * Segoe, so the drafts stay recognisably Inari there.
 */
export const SYSTEM_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var(--font-sans-family), system-ui, sans-serif'

/** Apple's standard "ease out, settle" curve — used for every state change. */
export const EASE = "cubic-bezier(0.32, 0.72, 0, 1)"

/*
 * Blue → green → amber, not grey → green → amber.
 *
 * "Unter dem Ziel" is the resting state of a plan being built, so it must read
 * as progress rather than as a fault: an unfilled grey bar on a grey track
 * disappears, and amber would cry wolf on every second row. Red stays reserved
 * for allergen conflicts. The three hues come from the app's own chart palette,
 * which is already validated for colour-vision separation.
 */
export const TONE: Record<TargetStatus, { fill: string; text: string; word: string }> = {
  low: {
    fill: "var(--chart-2)",
    text: "text-muted-foreground",
    word: "noch offen",
  },
  ok: {
    fill: "var(--color-urgency-ok)",
    text: "text-emerald-600 dark:text-emerald-400",
    word: "im Ziel",
  },
  high: {
    fill: "var(--color-urgency-due)",
    text: "text-amber-600 dark:text-amber-400",
    word: "über Ziel",
  },
}

/**
 * Allergen conflicts are the one thing on these screens that is not a matter of
 * degree, so they get the palette's "kritisch" red rather than the amber that
 * merely means "over the target".
 */
export const ALERT = "var(--urgency-overdue)"

export function decimalsFor(value: number): number {
  if (value === 0) return 0
  if (Math.abs(value) < 10) return 1
  return 0
}

export function formatValue(value: number, unit?: string): string {
  const text = formatNumber(value, decimalsFor(value))
  return unit ? `${text} ${unit}` : text
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                           */
/* -------------------------------------------------------------------------- */

interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>
  size?: "sm" | "md" | "lg"
  className?: string
  /** Stretches every segment to the same width, like a form control. */
  fill?: boolean
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  className,
  fill = false,
}: SegmentedControlProps<T>) {
  const padding = size === "sm" ? "px-3 py-1 text-[13px]" : size === "lg" ? "px-6 py-2.5 text-[15px]" : "px-4 py-1.5 text-sm"
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex gap-1 rounded-full bg-black/[0.05] p-1 dark:bg-white/[0.07]",
        fill && "w-full",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(option.value)}
            style={{ transitionTimingFunction: EASE }}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-all duration-300 active:scale-[0.97]",
              padding,
              fill && "flex-1",
              active
                ? "bg-white text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-white/[0.16]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Progress ring                                                               */
/* -------------------------------------------------------------------------- */

interface ProgressRingProps {
  /** 0–1; values above 1 draw a second, overshoot arc. */
  ratio: number
  size?: number
  stroke?: number
  status?: TargetStatus
  className?: string
  children?: React.ReactNode
}

export function ProgressRing({
  ratio,
  size = 132,
  stroke = 12,
  status = "ok",
  className,
  children,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const primary = Math.min(1, Math.max(0, ratio))
  const overshoot = Math.min(1, Math.max(0, ratio - 1))

  return (
    <div className={cn("relative flex-none", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="var(--color-track)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={TONE[status].fill}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - primary)}
          style={{ transition: `stroke-dashoffset 600ms ${EASE}, stroke 300ms ease` }}
        />
        {overshoot > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={TONE.high.fill}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - overshoot)}
            style={{ transition: `stroke-dashoffset 600ms ${EASE}` }}
          />
        )}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Target bar                                                                  */
/* -------------------------------------------------------------------------- */

interface TargetBarProps {
  reading: TargetReading
  /** `full` prints label, Ist/Soll and the bar; `compact` drops the goal. */
  variant?: "full" | "compact"
  className?: string
}

export function TargetBar({ reading, variant = "full", className }: TargetBarProps) {
  const pct = Math.min(100, Math.round(reading.ratio * 100))
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] font-medium">{reading.target.label}</span>
        <span className="text-[13px] whitespace-nowrap tabular-nums">
          <span className="font-semibold">{formatValue(reading.value)}</span>
          {variant === "full" && (
            <span className="text-muted-foreground">
              {" / "}
              {formatValue(reading.goal)} {reading.target.unit}
            </span>
          )}
        </span>
      </div>
      <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[var(--color-track)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: TONE[reading.status].fill,
            transition: `width 500ms ${EASE}, background-color 300ms ease`,
          }}
        />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                        */
/* -------------------------------------------------------------------------- */

/** iOS-style grouped list container: one rounded card, hairlines between rows. */
export function GroupedList({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[16px] border border-black/[0.06] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.08]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** A hairline that starts at the row's text inset, the way iOS draws them. */
export function ListSeparator({ inset = 16 }: { inset?: number }) {
  return (
    <div className="h-px bg-black/[0.07] dark:bg-white/[0.08]" style={{ marginLeft: inset }} />
  )
}

export function StatusPill({
  status,
  children,
  className,
}: {
  status: TargetStatus
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
        className,
      )}
      style={{
        color: TONE[status].fill,
        background: `color-mix(in oklab, ${TONE[status].fill} 12%, transparent)`,
      }}
    >
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The three button weights the drafts use, as plain elements rather than the
 * app's shadcn Button: the pill radius, the 0.97 press and the system type size
 * are the whole point of the exercise here.
 */
export function PrimaryButton({
  icon,
  children,
  className,
  ...props
}: React.ComponentProps<"button"> & { icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-[15px] font-semibold text-[var(--primary-foreground)] transition-transform duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export function SecondaryButton({
  icon,
  children,
  className,
  ...props
}: React.ComponentProps<"button"> & { icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center justify-center gap-2 rounded-full border border-black/[0.09] px-5 py-2.5 text-[15px] font-medium transition-colors hover:bg-black/[0.04] disabled:pointer-events-none disabled:opacity-40 dark:border-white/[0.12] dark:hover:bg-white/[0.06]",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export function RoundButton({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex size-9 flex-none items-center justify-center rounded-full bg-card shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all duration-200 hover:bg-black/[0.04] active:scale-[0.93] disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-white/[0.08]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Selection                                                                   */
/* -------------------------------------------------------------------------- */

export function ChoiceCard({
  selected,
  icon,
  title,
  hint,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  selected: boolean
  icon?: React.ReactNode
  title: string
  hint?: string
}) {
  return (
    <button
      type="button"
      style={{ transitionTimingFunction: EASE }}
      className={cn(
        "flex flex-col items-start gap-2.5 rounded-[18px] border p-4 text-left transition-all duration-300 active:scale-[0.98]",
        selected
          ? "border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] shadow-[0_2px_12px_-4px_var(--brand-shadow)]"
          : "border-black/[0.08] hover:bg-black/[0.03] dark:border-white/[0.1] dark:hover:bg-white/[0.05]",
        className,
      )}
      {...props}
    >
      {icon && (
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-full transition-colors",
            selected
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "bg-black/[0.05] text-muted-foreground dark:bg-white/[0.07]",
          )}
        >
          {icon}
        </span>
      )}
      <span className="text-[15px] font-semibold">{title}</span>
      {hint && <span className="text-[13px] leading-snug text-muted-foreground">{hint}</span>}
    </button>
  )
}

/** A toggle chip. `tone="alert"` marks the ones that carry a medical warning. */
export function Chip({
  active,
  tone,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { active: boolean; tone?: "alert" }) {
  return (
    <button
      type="button"
      style={{
        transitionTimingFunction: EASE,
        ...(active && tone === "alert"
          ? {
              background: `color-mix(in oklab, ${ALERT} 15%, transparent)`,
              color: ALERT,
              borderColor: `color-mix(in oklab, ${ALERT} 40%, transparent)`,
            }
          : {}),
      }}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-all duration-200 active:scale-[0.96]",
        active &&
          !tone &&
          "border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-[var(--primary)]",
        !active &&
          "border-black/[0.08] text-muted-foreground hover:bg-black/[0.04] dark:border-white/[0.1] dark:hover:bg-white/[0.06]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function ChipGroup({
  title,
  hint,
  options,
  selected,
  onToggle,
  tone,
}: {
  title: string
  hint?: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
  tone?: "alert"
}) {
  return (
    <div>
      <p className="text-[15px] font-semibold">{title}</p>
      {hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option}
            active={selected.includes(option)}
            tone={tone}
            onClick={() => onToggle(option)}
          >
            {option}
          </Chip>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

/** The drafts' standard panel: large radius, hairline border, one soft shadow. */
export function StudioCard({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-black/[0.06] bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:border-white/[0.08]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** Quiet inset panel used inside a card for a secondary block. */
export function InsetPanel({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-[16px] bg-black/[0.03] p-4 dark:bg-white/[0.04]", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
        {children}
      </h3>
      {action}
    </div>
  )
}
