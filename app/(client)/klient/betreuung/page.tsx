import { redirect } from "next/navigation"

import { ClientCareView } from "@/components/client/client-care-view"
import {
  fetchActiveLinksForClient,
  fetchCounselorNames,
  fetchPatientNames,
} from "@/lib/data/client-links"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { ClientLinkWithCounselor } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function ClientCarePage() {
  const authOptional =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (authOptional || process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true") {
    return <ClientCareView links={[]} />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  let links: ClientLinkWithCounselor[] = []

  try {
    const activeLinks = await fetchActiveLinksForClient(supabase, user.id)

    if (activeLinks.length > 0) {
      const service = await createServiceClient()
      const [counselorNames, patientNames] = await Promise.all([
        fetchCounselorNames(service, activeLinks.map((link) => link.counselorUserId)),
        fetchPatientNames(service, activeLinks.map((link) => link.patientId)),
      ])

      links = activeLinks.map((link) => ({
        ...link,
        counselorName: counselorNames.get(link.counselorUserId) ?? "Ernährungsberatung",
        patientName: patientNames.get(link.patientId) ?? "",
      }))
    }
  } catch (error) {
    console.warn("Failed to load client links:", error)
  }

  return <ClientCareView links={links} />
}
