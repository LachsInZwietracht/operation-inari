"use client"

import { useTransition } from "react"
import { ArrowLeftRight, Loader2 } from "lucide-react"

import { setAppModeAction } from "@/app/(client)/actions"
import { Button } from "@/components/ui/button"
import type { AppMode } from "@/lib/types"

const LABELS: Record<AppMode, string> = {
  counselor: "Zur Beratungs-Ansicht",
  client: "Zur Klienten-Ansicht",
}

/**
 * Switches the active surface. The server action sets the mode cookie and
 * redirects, so the new surface renders server-side from the first paint.
 */
export function ModeSwitchButton({
  target,
  variant = "outline",
  size = "sm",
  className,
}: {
  target: AppMode
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={isPending}
      onClick={() => startTransition(() => void setAppModeAction(target))}
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <ArrowLeftRight className="mr-2 h-4 w-4" />
      )}
      {LABELS[target]}
    </Button>
  )
}
