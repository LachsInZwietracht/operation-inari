import { ClientInviteAccept } from "@/components/client/client-invite-accept"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isValidInviteCodeFormat, normalizeInviteCode } from "@/lib/client-mode"
import { fetchCounselorNames } from "@/lib/data/client-links"
import { createServiceClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface InvitePageProps {
  params: Promise<{ code: string }>
}

function InviteMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  )
}

export default async function ClientInvitePage({ params }: InvitePageProps) {
  const { code: rawCode } = await params
  const code = normalizeInviteCode(decodeURIComponent(rawCode))

  if (!isValidInviteCodeFormat(code)) {
    return (
      <InviteMessage title="Einladung ungültig">
        Dieser Einladungslink stimmt nicht. Bitte prüfe den Code oder lass dir einen neuen
        schicken.
      </InviteMessage>
    )
  }

  // The invite is not readable through RLS before it is redeemed — the
  // recipient is not yet a participant of the link.
  const service = await createServiceClient()
  const { data: link } = await service
    .from("client_links")
    .select("id,status,invite_expires_at,counselor_user_id")
    .eq("invite_code", code)
    .maybeSingle()

  if (!link) {
    return (
      <InviteMessage title="Einladung nicht gefunden">
        Diesen Einladungscode gibt es nicht.
      </InviteMessage>
    )
  }

  if (link.status === "revoked") {
    return (
      <InviteMessage title="Einladung zurückgezogen">
        Diese Einladung ist nicht mehr gültig.
      </InviteMessage>
    )
  }

  if (link.status === "active") {
    return (
      <InviteMessage title="Einladung bereits eingelöst">
        Diese Einladung wurde schon angenommen.
      </InviteMessage>
    )
  }

  if (link.invite_expires_at && new Date(link.invite_expires_at) < new Date()) {
    return (
      <InviteMessage title="Einladung abgelaufen">
        Bitte lass dir von deiner Ernährungsberatung eine neue Einladung schicken.
      </InviteMessage>
    )
  }

  const counselorNames = await fetchCounselorNames(service, [link.counselor_user_id])

  return (
    <ClientInviteAccept
      code={code}
      counselorName={counselorNames.get(link.counselor_user_id) ?? "Deine Ernährungsberatung"}
    />
  )
}
