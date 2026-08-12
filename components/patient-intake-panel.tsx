"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Check, Copy, Loader2, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PatientIntakeInviteDialog } from "@/components/patient-intake-invite-dialog"
import { PatientIntakeReview } from "@/components/patient-intake-review"
import { usePatientIntake } from "@/hooks/use-patient-intake"
import type { PatientIntakeLink, PatientIntakeLinkStatus } from "@/lib/types"

const STATUS_LABELS: Record<PatientIntakeLinkStatus, string> = {
  pending: "Offen",
  received: "Ausgefüllt",
  expired: "Abgelaufen",
  revoked: "Zurückgezogen",
}

const STATUS_VARIANTS: Record<
  PatientIntakeLinkStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  received: "default",
  expired: "outline",
  revoked: "outline",
}

interface PatientIntakePanelProps {
  /** Scopes the panel to a single patient's re-onboarding invitations. */
  patientId?: string
  defaultLabel?: string
}

export function PatientIntakePanel({ patientId, defaultLabel }: PatientIntakePanelProps) {
  const {
    links,
    isLoading,
    error,
    createLink,
    revokeLink,
    deleteLink,
    applySubmission,
    getSubmissionForLink,
  } = usePatientIntake()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null)

  const visibleLinks = useMemo(
    () => (patientId ? links.filter((link) => link.patientId === patientId) : links),
    [links, patientId],
  )

  async function handleCopy(link: PatientIntakeLink) {
    try {
      await navigator.clipboard.writeText(link.url)
      setCopiedId(link.id)
      toast.success("Link kopiert")
      window.setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error("Link konnte nicht kopiert werden")
    }
  }

  async function handleApply(submissionId: string) {
    setApplyingId(submissionId)
    try {
      const { patientId: appliedPatientId } = await applySubmission(submissionId)
      toast.success("Angaben übernommen", {
        description: "Weiter geht es mit dem Ernährungsplan.",
      })
      return appliedPatientId
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Übernahme fehlgeschlagen",
      )
      return null
    } finally {
      setApplyingId(null)
    }
  }

  async function handleRevoke(linkId: string) {
    try {
      await revokeLink(linkId)
      toast.success("Einladung zurückgezogen")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Aktion fehlgeschlagen")
    }
  }

  async function handleDelete(linkId: string) {
    try {
      await deleteLink(linkId)
      toast.success("Einladung gelöscht")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Aktion fehlgeschlagen")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Onboarding-Einladungen</CardTitle>
          <CardDescription>
            Link oder QR-Code teilen. Die Person füllt Ziele, Vorlieben und
            Unverträglichkeiten selbst am Handy aus.
          </CardDescription>
        </div>
        <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Einladung erstellen
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {isLoading && visibleLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Einladungen werden geladen…</p>
        ) : null}

        {!isLoading && visibleLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Einladungen. Erstelle eine, um jemanden ohne Login onboarden zu
            lassen.
          </p>
        ) : null}

        {visibleLinks.map((link) => {
          const submission = getSubmissionForLink(link.id)
          const isExpanded = expandedLinkId === link.id

          return (
            <div key={link.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{link.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Erstellt am {new Date(link.createdAt).toLocaleDateString("de-DE")}
                    {link.expiresAt
                      ? ` · gültig bis ${new Date(link.expiresAt).toLocaleDateString("de-DE")}`
                      : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUS_VARIANTS[link.status]}>
                    {STATUS_LABELS[link.status]}
                  </Badge>

                  {link.status === "pending" ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(link)}
                      >
                        {copiedId === link.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        <span className="sr-only">Link kopieren</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevoke(link.id)}
                      >
                        Zurückziehen
                      </Button>
                    </>
                  ) : null}

                  {submission ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedLinkId(isExpanded ? null : link.id)}
                    >
                      {isExpanded ? "Schließen" : "Antworten ansehen"}
                    </Button>
                  ) : null}

                  {link.status !== "pending" && !submission ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(link.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Einladung löschen</span>
                    </Button>
                  ) : null}
                </div>
              </div>

              {submission && submission.status === "applied" ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">Übernommen.</p>
                  {submission.appliedPatientId ? (
                    <>
                      {/* The next step in the chain is the plan, so offer it here
                          rather than making the user navigate back out. */}
                      <Button type="button" size="sm" asChild>
                        <Link href={`/ernaehrungsplan?patientId=${submission.appliedPatientId}`}>
                          Plan starten
                        </Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={`/patienten/${submission.appliedPatientId}`}>
                          Zum Patienten
                        </Link>
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}

              {submission && submission.status === "discarded" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Verworfen. Die ursprüngliche Antwort bleibt zur Nachvollziehbarkeit erhalten.
                </p>
              ) : null}

              {submission && isExpanded ? (
                <div className="mt-3 border-t pt-3">
                  <PatientIntakeReview submission={submission} />

                  {submission.status === "new" || submission.status === "reviewed" ? (
                    <Button
                      type="button"
                      className="mt-4 w-full sm:w-auto"
                      disabled={applyingId === submission.id}
                      onClick={() => handleApply(submission.id)}
                    >
                      {applyingId === submission.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Übernehmen
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </CardContent>

      <PatientIntakeInviteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultLabel={defaultLabel}
        patientId={patientId}
        onCreate={createLink}
      />
    </Card>
  )
}
