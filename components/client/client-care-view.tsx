"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  redeemClientInviteAction,
  revokeClientLinkAsClientAction,
  setClientWellbeingConsentAction,
} from "@/app/(client)/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { isClientCapabilityEnabled } from "@/lib/client-modules"
import { formatInviteCode } from "@/lib/client-mode"
import type { ClientLinkWithCounselor } from "@/lib/types"

export function ClientCareView({ links }: { links: ClientLinkWithCounselor[] }) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [isPending, startTransition] = useTransition()
  const [revokingId, setRevokingId] = useState<string | null>(null)

  function handleRedeem() {
    startTransition(async () => {
      const result = await redeemClientInviteAction({ code })
      if (result.status === "error") {
        toast.error(result.message ?? "Die Einladung konnte nicht angenommen werden.")
        return
      }
      toast.success("Verbindung hergestellt.")
      setCode("")
      router.refresh()
    })
  }

  function handleWellbeingConsent(linkId: string, consent: boolean) {
    startTransition(async () => {
      const result = await setClientWellbeingConsentAction({ linkId, consent })
      if (result.status === "error") {
        toast.error(result.message ?? "Die Freigabe konnte nicht geändert werden.")
        return
      }
      toast.success(result.message ?? "Freigabe geändert.")
      router.refresh()
    })
  }

  function handleRevoke(linkId: string) {
    setRevokingId(linkId)
    startTransition(async () => {
      const result = await revokeClientLinkAsClientAction({ linkId })
      setRevokingId(null)
      if (result.status === "error") {
        toast.error(result.message ?? "Die Verbindung konnte nicht beendet werden.")
        return
      }
      toast.success("Verbindung beendet.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Betreuung</h1>
        <p className="text-sm text-muted-foreground">
          Hier siehst du, wer deine Einträge sehen darf.
        </p>
      </div>

      {links.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Noch keine Verbindung</CardTitle>
            <CardDescription>
              Dein Tagebuch gehört dir. Erst wenn du eine Einladung annimmst, kann deine
              Ernährungsberatung mitlesen.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        links.map((link) => (
          <Card key={link.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{link.counselorName}</CardTitle>
              <CardDescription>
                Verbunden seit{" "}
                {format(parseISO(link.consentedAt ?? link.createdAt), "d. MMMM yyyy", {
                  locale: de,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Freigegeben: dein Ernährungstagebuch. Deine Beratung kann mitlesen, aber nichts
                für dich eintragen oder löschen.
              </p>

              {/* Its own switch, because how someone felt is not a list of
                  foods and ending the whole connection is too blunt an answer
                  to "das möchte ich gerade nicht teilen". */}
              {isClientCapabilityEnabled("befinden") && (
                <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">Befinden freigeben</p>
                    <p className="text-xs text-muted-foreground">
                      Wohlbefinden, Schlaf und was du sonst im Check-in einträgst. Welche
                      einzelnen Werte dazugehören, entscheidest du in den Einstellungen.
                    </p>
                  </div>
                  <Switch
                    aria-label="Befinden freigeben"
                    checked={link.consentWellbeing}
                    disabled={isPending}
                    onCheckedChange={(checked) => handleWellbeingConsent(link.id, checked)}
                  />
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleRevoke(link.id)}
              >
                {revokingId === link.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verbindung beenden
              </Button>
            </CardContent>
          </Card>
        ))
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Einladungscode einlösen</CardTitle>
          <CardDescription>
            Du hast einen Code von deiner Ernährungsberatung bekommen? Dann gib ihn hier ein.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="client-invite-code">Code</Label>
            <Input
              id="client-invite-code"
              placeholder="ABCD-EFGH"
              autoCapitalize="characters"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onBlur={() => setCode((value) => (value ? formatInviteCode(value) : value))}
            />
          </div>
          <Button disabled={isPending || code.trim().length === 0} onClick={handleRedeem}>
            {isPending && !revokingId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verbinden
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
