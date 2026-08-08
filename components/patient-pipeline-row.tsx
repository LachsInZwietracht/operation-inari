"use client"

import Link from "next/link"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { PatientStatusChip } from "@/components/patient-status-chip"
import { formatDate } from "@/lib/format"
import { PATIENT_STATUS_META, type PatientPipelineRow } from "@/lib/patient-status"

interface PatientPipelineRowProps {
  row: PatientPipelineRow
  /** Opens the intake review for a row whose questionnaire came back. */
  onReview: (row: PatientPipelineRow) => void
}

/**
 * One line in the unified patient list.
 *
 * Rows are dense and scannable rather than cards: the practitioner is looking
 * for one person or one state, and a card grid makes both harder. Every row ends
 * in exactly one primary action, derived from its pipeline status.
 */
export function PatientPipelineListRow({ row, onReview }: PatientPipelineRowProps) {
  const [copied, setCopied] = useState(false)
  const meta = PATIENT_STATUS_META[row.status]
  const { patient } = row

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

  const secondary = patient
    ? [
        patient.indications?.length ? patient.indications.join(" · ") : "Ohne Indikation",
        row.lastSessionDate
          ? `Letzte Beratung ${formatDate(row.lastSessionDate)}`
          : "Noch keine Beratung",
      ].join(" · ")
    : row.link
      ? `Einladung · erstellt ${formatDate(row.link.createdAt)}`
      : "Einladung"

  function renderAction() {
    // Questionnaire is back and needs review — the one state where someone is
    // actively waiting on the practitioner.
    if (row.status === "antwort_da") {
      return (
        <Button type="button" size="sm" onClick={() => onReview(row)}>
          {meta.action}
        </Button>
      )
    }

    if (!patient) {
      // A pending invitation: the only useful action is re-sharing the link.
      return row.link ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleCopy(row.link!.url)}
        >
          {copied ? (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <Copy className="mr-1.5 h-3.5 w-3.5" />
          )}
          Link kopieren
        </Button>
      ) : null
    }

    if (row.status === "bereit") {
      return (
        <Button asChild size="sm">
          <Link href={`/ernaehrungsplan?patientId=${patient.id}`}>{meta.action}</Link>
        </Button>
      )
    }

    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/patienten/${patient.id}`}>{meta.action}</Link>
      </Button>
    )
  }

  const nameNode = patient ? (
    <Link
      href={`/patienten/${patient.id}`}
      data-patient-id={patient.id}
      className="truncate font-medium hover:underline"
    >
      {row.displayName}
    </Link>
  ) : (
    <span className="truncate font-medium">{row.displayName}</span>
  )

  return (
    <div
      className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50"
      data-pipeline-status={row.status}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {nameNode}
          <PatientStatusChip status={row.status} />
        </div>
        <p className="truncate text-xs text-muted-foreground">{secondary}</p>
      </div>
      <div className="shrink-0">{renderAction()}</div>
    </div>
  )
}
