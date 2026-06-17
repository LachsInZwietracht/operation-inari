import { cache } from "react";

import { fetchCurrentMembership, getCurrentUser } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import type { FoodSourceId } from "@/lib/types";

interface ActivationRow {
  source_id: string;
  is_active: boolean;
}

/**
 * Returns the data source IDs the current user's organization has explicitly
 * switched off. Absence of a row means the source stays active, so an empty
 * result preserves the default-on behaviour.
 *
 * Resolution is best-effort: if there is no authenticated user, no membership,
 * or the settings table is unavailable, it returns an empty list rather than
 * blocking food queries. Wrapped in React `cache` so the membership lookup is
 * deduped within a single request.
 */
export const fetchOrganizationDisabledSourceIds = cache(async (): Promise<FoodSourceId[]> => {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);
    if (!user) return [];

    const membership = await fetchCurrentMembership(supabase, user.id);
    if (!membership) return [];

    const { data, error } = await supabase
      .from("organization_data_source_settings")
      .select("source_id,is_active")
      .eq("organization_id", membership.organizationId)
      .eq("is_active", false);

    if (error) return [];

    return ((data ?? []) as ActivationRow[]).map((row) => row.source_id as FoodSourceId);
  } catch {
    return [];
  }
});
