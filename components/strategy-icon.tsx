import { cn } from "@/lib/utils"

/**
 * The plan strategy's own icon set.
 *
 * These are drawn images rather than `lucide-react` glyphs, so they cannot
 * simply inherit `text-foreground` the way an SVG does. Each file is a black
 * shape on a transparent background, and it is used as a CSS mask over a
 * `bg-current` box: the image decides the shape, the surrounding text colour
 * decides the paint. That keeps them correct in both themes and lets a caller
 * tint one with a plain text colour class, exactly like a Lucide icon.
 *
 * Every file is normalised to the same 192px canvas, the same content box and
 * the same stroke weight, which is what keeps them looking like one set next to
 * the Lucide icons they sit beside. Re-run that normalisation if you add one —
 * a raw generated PNG will be visibly lighter or heavier than the rest.
 */
const STRATEGY_ICONS = {
  ziel: "/icons/strategy/ziel.png",
  zielwerte: "/icons/strategy/zielwerte.png",
  rahmen: "/icons/strategy/rahmen.png",
  umsetzung: "/icons/strategy/umsetzung.png",
} as const

const DIRECTION_ICONS = {
  reduce: "/icons/strategy/abnehmen.png",
  hold: "/icons/strategy/halten.png",
  build: "/icons/strategy/aufbauen.png",
} as const

export type StrategyIconName = keyof typeof STRATEGY_ICONS
export type DirectionIconName = keyof typeof DIRECTION_ICONS

function maskStyle(src: string) {
  return {
    maskImage: `url(${src})`,
    maskSize: "contain",
    maskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskImage: `url(${src})`,
    WebkitMaskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
  } satisfies React.CSSProperties
}

/**
 * A strategy card's heading icon. Larger than the 16px Lucide default on
 * purpose: a drawn icon loses its detail at that size where a line glyph does
 * not.
 */
export function StrategyIcon({
  name,
  className,
}: {
  name: StrategyIconName
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-5 shrink-0 bg-current", className)}
      style={maskStyle(STRATEGY_ICONS[name])}
    />
  )
}

/** Which way the weight is meant to go — down, flat or up. */
export function DirectionIcon({
  direction,
  className,
}: {
  direction: DirectionIconName
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-[18px] shrink-0 bg-current", className)}
      style={maskStyle(DIRECTION_ICONS[direction])}
    />
  )
}
