"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { redeemClientInviteAction } from "@/app/(client)/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatInviteCode } from "@/lib/client-mode"

export function ClientInviteAccept({
  code,
  counselorName,
}: {
  code: string
  counselorName: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleAccept() {
    startTransition(async () => {
      const result = await redeemClientInviteAction({ code })
      if (result.status === "error") {
        toast.error(result.message ?? "Die Einladung konnte nicht angenommen werden.")
        return
      }
      toast.success("Verbindung hergestellt.")
      router.push("/klient")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Einladung von {counselorName}</CardTitle>
        <CardDescription>Code {formatInviteCode(code)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Wenn du zustimmst, darf {counselorName}:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>dein Ernährungstagebuch lesen</li>
            <li>
              sehen, wie es dir an einem Tag ging — Wohlbefinden, Schlaf und was du sonst im
              Check-in einträgst
            </li>
          </ul>
          <p>
            Deine Einträge gehören weiterhin dir. Deine Beratung kann nichts für dich eintragen
            oder löschen, und du kannst die Verbindung jederzeit unter „Betreuung“ beenden. Was
            von deinem Befinden geteilt wird, entscheidest du einzeln in den Einstellungen — und
            die Freigabe dafür kannst du unter „Betreuung“ auch allein zurückziehen.
          </p>
        </div>

        <Button disabled={isPending} onClick={handleAccept}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Einladung annehmen
        </Button>
      </CardContent>
    </Card>
  )
}
