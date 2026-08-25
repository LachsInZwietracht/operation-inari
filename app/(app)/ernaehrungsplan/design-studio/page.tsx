import type { Metadata } from "next"

import { DesignStudioClient } from "@/components/plan-design-studio/design-studio-client"

export const metadata: Metadata = {
  title: "Design-Studio · Ernährungsplan",
}

/**
 * Design studio for the Ernährungsplan-Erstellung.
 *
 * Three interactive drafts of the planner UI for a team decision. Deliberately
 * server-data-free: the drafts run on a fixed demo catalogue so the page opens
 * without a patient, a diet line or a catalogue query, and behaves identically
 * for everyone who is sent the link.
 */
export default function ErnaehrungsplanDesignStudioPage() {
  return <DesignStudioClient />
}
