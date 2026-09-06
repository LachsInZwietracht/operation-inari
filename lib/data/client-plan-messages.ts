import { createClient } from "@/lib/supabase/client"

export interface ClientPlanMessage {
  patients: { first_name: string; last_name: string } | null
  id: string
  patient_id: string
  meal_plan_id: string
  meal_entry_id: string | null
  ingredient_id: string | null
  plan_date: string
  revision_number: number
  target_label: string
  kind: "alternative" | "feedback"
  body: string
  status: "open" | "resolved"
  response: string | null
  created_at: string
}

export async function fetchPlanMessages(patientId?: string, planId?: string) {
  let query = createClient().from("client_plan_messages")
    .select("id,patient_id,meal_plan_id,meal_entry_id,ingredient_id,plan_date,revision_number,target_label,kind,body,status,response,created_at,patients(first_name,last_name)")
    .order("status", { ascending: true }).order("created_at", { ascending: false })
  if (patientId) query = query.eq("patient_id", patientId)
  if (planId) query = query.eq("meal_plan_id", planId)
  if (!patientId && !planId) query = query.eq("kind", "alternative").eq("status", "open")
  const { data, error } = await query.limit(200)
  if (error) throw error
  return data as unknown as ClientPlanMessage[]
}

export async function sendPlanMessage(planId: string, body: string, entryId?: string, ingredientId?: string) {
  const { error } = await createClient().rpc("send_client_plan_message", {
    p_plan_id: planId, p_body: body, p_entry_id: entryId ?? null, p_ingredient_id: ingredientId ?? null,
  })
  if (error) throw error
}

export async function resolvePlanMessage(id: string, response: string) {
  const { error } = await createClient().rpc("resolve_client_plan_message", { p_id: id, p_response: response })
  if (error) throw error
}
