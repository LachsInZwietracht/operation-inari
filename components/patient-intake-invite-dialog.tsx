"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Loader2, QrCode } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PatientIntakeLink } from "@/lib/types"

interface PatientIntakeInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preset label, e.g. the patient name when re-onboarding. */
  defaultLabel?: string
  /** Set when the invitation belongs to an existing patient. */
  patientId?: string
  onCreate: (input: {
    label: string
    patientId?: string
    expiresAt?: string
  }) => Promise<PatientIntakeLink>
}

const DEFAULT_EXPIRY_DAYS = 14

function defaultExpiryDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + DEFAULT_EXPIRY_DAYS)
  return date.toISOString().slice(0, 10)
}

/**
 * Creates an onboarding invitation and hands back a link plus QR code.
 * The QR is generated in the browser and never stored — see the migrations that
 * removed stored QR payloads from the digital protocol links.
 */
export function PatientIntakeInviteDialog({
  open,
  onOpenChange,
  defaultLabel,
  patientId,
  onCreate,
}: PatientIntakeInviteDialogProps) {
  const [label, setLabel] = useState(defaultLabel ?? "")
  const [expiresAt, setExpiresAt] = useState(defaultExpiryDate)
  const [isCreating, setIsCreating] = useState(false)
  const [createdLink, setCreatedLink] = useState<PatientIntakeLink | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Reset on close in the event handler rather than an effect, so closing does
  // not schedule a second render pass.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setCreatedLink(null)
      setQrDataUrl(null)
      setCopied(false)
      setLabel(defaultLabel ?? "")
      setExpiresAt(defaultExpiryDate())
    }
    onOpenChange(nextOpen)
  }

  useEffect(() => {
    if (!createdLink) return

    let cancelled = false
    async function renderQr(url: string) {
      try {
        const { toDataURL } = await import("qrcode")
        const dataUrl = await toDataURL(url, { margin: 1, width: 320 })
        if (!cancelled) setQrDataUrl(dataUrl)
      } catch {
        // The link itself still works; only the QR preview is missing.
        if (!cancelled) setQrDataUrl(null)
      }
    }

    void renderQr(createdLink.url)
    return () => {
      cancelled = true
    }
  }, [createdLink])

  async function handleCreate() {
    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      toast.error("Bitte eine Bezeichnung angeben")
      return
    }

    setIsCreating(true)
    try {
      const link = await onCreate({
        label: trimmedLabel,
        patientId,
        expiresAt: expiresAt || undefined,
      })
      setCreatedLink(link)
      toast.success("Einladung erstellt")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Einladung konnte nicht erstellt werden",
      )
    } finally {
      setIsCreating(false)
    }
  }

  async function handleCopy() {
    if (!createdLink) return
    try {
      await navigator.clipboard.writeText(createdLink.url)
      setCopied(true)
      toast.success("Link kopiert")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Link konnte nicht kopiert werden")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {createdLink ? "Einladung teilen" : "Onboarding-Einladung erstellen"}
          </DialogTitle>
          <DialogDescription>
            {createdLink
              ? "Link oder QR-Code weitergeben. Die Person füllt den Fragebogen selbst am Handy aus."
              : patientId
                ? "Der bestehende Patient füllt den Fragebogen erneut aus."
                : "Es wird noch kein Patient angelegt. Der Patient entsteht, sobald du die Antworten übernimmst."}
          </DialogDescription>
        </DialogHeader>

        {createdLink ? (
          <div className="space-y-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- generated data URL, not a remote asset
              <img
                src={qrDataUrl}
                alt={`QR-Code für die Einladung ${createdLink.label}`}
                className="mx-auto h-48 w-48 rounded-lg border bg-white p-2"
              />
            ) : (
              <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-lg border">
                <QrCode className="h-8 w-8 text-muted-foreground" />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input readOnly value={createdLink.url} className="text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">Link kopieren</span>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Der Link ist einmalig gültig
              {createdLink.expiresAt
                ? ` und läuft am ${new Date(createdLink.expiresAt).toLocaleDateString("de-DE")} ab`
                : ""}
              .
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="intake-label">Bezeichnung</Label>
              <Input
                id="intake-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="z. B. Max - Freund"
              />
              <p className="text-xs text-muted-foreground">
                Nur für dich, damit du die Einladung wiedererkennst.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="intake-expiry">Gültig bis</Label>
              <Input
                id="intake-expiry"
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {createdLink ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Fertig
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Abbrechen
              </Button>
              <Button type="button" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Einladung erstellen
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
