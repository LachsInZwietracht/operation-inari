"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { IntakeTransition } from "@/lib/intake-transitions"
import { INTAKE_STAGE_META, type IntakeRow, type IntakeStage } from "@/lib/patient-journey"

interface IntakeTransitionDialogProps {
  /** The pending move, or null when nothing is being moved. */
  move: { row: IntakeRow; transition: IntakeTransition } | null
  onClose: () => void
  /** Open the questionnaire review for this row. */
  onReview: (row: IntakeRow) => void
  /** Open the invitation dialog. */
  onInvite: () => void
  /** Pin the stage by hand. Resolves once the write has gone through. */
  onOverride: (row: IntakeRow, stage: IntakeStage) => Promise<void>
}

/**
 * What a dragged card actually means.
 *
 * A stage is derived, so the dialog never just "moves" anything. It names the
 * one fact that is missing and offers the action that supplies it — apply the
 * waiting questionnaire, create the record, document the session. Do that, and
 * the card moves on its own because the stage is now true.
 *
 * The override underneath is the deliberate exception, kept visually quiet and
 * spelled out: it pins a stage that the data does not support.
 */
export function IntakeTransitionDialog({
  move,
  onClose,
  onReview,
  onInvite,
  onOverride,
}: IntakeTransitionDialogProps) {
  const [overriding, setOverriding] = useState(false)
  const [confirmingOverride, setConfirmingOverride] = useState(false)

  function close() {
    setConfirmingOverride(false)
    onClose()
  }

  async function handleOverride() {
    if (!move) return
    setOverriding(true)
    try {
      await onOverride(move.row, move.transition.to)
      close()
    } finally {
      setOverriding(false)
    }
  }

  const transition = move?.transition
  const fromMeta = transition ? INTAKE_STAGE_META[transition.from] : null
  const toMeta = transition ? INTAKE_STAGE_META[transition.to] : null

  return (
    <Dialog open={Boolean(move)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-lg">
        {transition && fromMeta && toMeta ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-[15px]">{transition.title}</DialogTitle>
              <DialogDescription className="sr-only">
                Was für diesen Schritt noch fehlt.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 text-[12.5px]">
              <StagePill color={fromMeta.color} label={fromMeta.label} />
              <ArrowRight className="size-3.5 shrink-0 text-fg-3" aria-hidden="true" />
              <StagePill color={toMeta.color} label={toMeta.label} />
            </div>

            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {transition.explanation}
            </p>

            {transition.action ? (
              <TransitionAction
                action={transition.action}
                row={move.row}
                onReview={(row) => {
                  close()
                  onReview(row)
                }}
                onInvite={() => {
                  close()
                  onInvite()
                }}
                onNavigate={close}
              />
            ) : null}

            <DialogFooter className="mt-1 flex-col items-stretch gap-2 border-t pt-3 sm:flex-col sm:items-stretch">
              {confirmingOverride ? (
                <div className="space-y-2 rounded-md border border-dashed p-3">
                  <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
                    <AlertTriangle
                      className="mt-px size-3.5 shrink-0 text-[var(--urgency-due)]"
                      aria-hidden="true"
                    />
                    <span>{transition.overrideWarning}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={overriding}
                      onClick={handleOverride}
                    >
                      {overriding ? "Wird gesetzt…" : `Trotzdem auf „${toMeta.label}" setzen`}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={overriding}
                      onClick={() => setConfirmingOverride(false)}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <Button size="sm" variant="ghost" onClick={close}>
                    Schließen
                  </Button>
                  {transition.canOverride ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingOverride(true)}
                      className="rounded-md px-1.5 py-1 text-[11.5px] text-fg-3 underline-offset-2 transition-colors hover:text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground"
                    >
                      Stufe trotzdem von Hand setzen
                    </button>
                  ) : (
                    <span className="text-[11.5px] text-fg-4">
                      Von Hand setzen geht erst mit einer Patientenakte
                    </span>
                  )}
                </div>
              )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function StagePill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-chip px-2 py-1">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </span>
  )
}

function TransitionAction({
  action,
  row,
  onReview,
  onInvite,
  onNavigate,
}: {
  action: NonNullable<IntakeTransition["action"]>
  row: IntakeRow
  onReview: (row: IntakeRow) => void
  onInvite: () => void
  onNavigate: () => void
}) {
  const [copied, setCopied] = useState(false)

  switch (action.type) {
    case "review":
      return (
        <Button size="sm" className="self-start" onClick={() => onReview(row)}>
          {action.label}
        </Button>
      )

    case "invite":
      return (
        <Button size="sm" className="self-start" onClick={onInvite}>
          {action.label}
        </Button>
      )

    case "copy-link":
      return (
        <Button
          size="sm"
          className="self-start"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(action.url)
              setCopied(true)
            } catch {
              setCopied(false)
            }
          }}
        >
          {copied ? "Link kopiert" : action.label}
        </Button>
      )

    case "navigate":
      return (
        <Button size="sm" className="self-start" asChild>
          <Link href={action.href} onClick={onNavigate}>
            {action.label}
          </Link>
        </Button>
      )
  }
}
