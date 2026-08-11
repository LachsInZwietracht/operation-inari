"use client"

import Link from "next/link"
import { useState } from "react"
import { Check } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { INTAKE_STAGE_META, type IntakeRow } from "@/lib/patient-journey"

interface IntakeRowActionProps {
  row: IntakeRow
  /** Opens the intake review for a row whose questionnaire came back. */
  onReview: (row: IntakeRow) => void
  /** Set once a row's action has failed, which disables it until data reloads. */
  disabled?: boolean
}

const ACTION_CLASSES =
  "inline-flex h-7 items-center justify-center rounded-md border bg-btn px-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"

/**
 * The single primary action a row offers, derived from its stage.
 *
 * Exactly one, never a menu: the whole point of sorting people into stages is
 * that the next move is already decided by the time you look at the row.
 */
export function IntakeRowAction({ row, onReview, disabled = false }: IntakeRowActionProps) {
  const [copied, setCopied] = useState(false)
  const label = INTAKE_STAGE_META[row.stage].action

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Link kopiert")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Link konnte nicht kopiert werden")
    }
  }

  if (row.stage === "fragebogen") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onReview(row)}
        className={ACTION_CLASSES}
      >
        {label}
      </button>
    )
  }

  if (row.stage === "eingeladen") {
    // Without a link there is nothing to re-share; showing a dead button would
    // be worse than showing none.
    if (!row.link) return null

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleCopy(row.link!.url)}
        className={cn(ACTION_CLASSES, "gap-1.5")}
      >
        {copied ? <Check className="size-3" aria-hidden="true" /> : null}
        {label}
      </button>
    )
  }

  // Both remaining stages need a patient record to point at.
  if (!row.patient) return null

  const href =
    row.stage === "plan"
      ? `/ernaehrungsplan?patientId=${row.patient.id}`
      : // Termine owns its own filter state and takes no query parameters, so
        // this lands on the calendar rather than a pre-filled booking.
        "/termine"

  return (
    <Link
      href={href}
      prefetch={false}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      className={cn(ACTION_CLASSES, disabled && "pointer-events-none opacity-50")}
    >
      {label}
    </Link>
  )
}
