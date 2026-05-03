import type { SupabaseClient } from "@supabase/supabase-js";

export interface AccessAuditInput {
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

interface MembershipRow {
  organization_id: string | null;
}

async function resolveActorUserId(supabase: SupabaseClient, actorUserId?: string) {
  if (actorUserId) return actorUserId;

  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  return data.user?.id ?? null;
}

async function resolveOrganizationId(supabase: SupabaseClient, actorUserId: string) {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", actorUserId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as MembershipRow | null)?.organization_id ?? null;
}

export async function writeAccessAuditLog(
  supabase: SupabaseClient,
  input: AccessAuditInput,
  options: { actorUserId?: string } = {},
) {
  try {
    const actorUserId = await resolveActorUserId(supabase, options.actorUserId);
    if (!actorUserId) return;

    const organizationId = await resolveOrganizationId(supabase, actorUserId);
    if (!organizationId) return;

    const { error } = await supabase.from("access_audit_logs").insert({
      organization_id: organizationId,
      actor_user_id: actorUserId,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId,
      metadata: input.metadata ?? {},
    });

    if (error) throw new Error(error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Access audit log skipped for ${input.action}:`, message);
  }
}
