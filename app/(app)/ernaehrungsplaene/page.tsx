import { ErnaehrungsplaenePageClient } from "./ernaehrungsplaene-client";
import { fetchMealPlans } from "@/lib/data/meal-plans";
import { fetchPatients } from "@/lib/data/patients";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/verified-user";
import type { DailyMealPlan, Patient } from "@/lib/types";

/**
 * Every plan the practice has built, filed under the patient it belongs to.
 *
 * The page used to be four navigation tiles, which answered "where do I go"
 * and never "what have I already made". A plan only ever exists for a patient,
 * so the patient is the heading and the plans sit under it.
 */
async function loadInitialData(): Promise<{
  patients: Patient[];
  plans: DailyMealPlan[];
} | null> {
  const authOptional =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING === "true" || authOptional) {
    return null;
  }

  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);
  if (!user) return null;

  try {
    const [patients, plans] = await Promise.all([
      fetchPatients(supabase),
      fetchMealPlans({ supabase, userId: user.id, includeSystem: false }),
    ]);
    return { patients, plans };
  } catch (error) {
    console.warn("Failed to load meal plan overview:", error);
    return null;
  }
}

export default async function ErnaehrungsplaenePage() {
  const initialData = await loadInitialData();

  return (
    <ErnaehrungsplaenePageClient
      initialPatients={initialData?.patients ?? []}
      initialPlans={initialData?.plans ?? []}
    />
  );
}
