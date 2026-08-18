import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientCheckin, ClientMetricPreferenceRow } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/data/utils";

/**
 * The check-in is client-owned in the strictest sense in this codebase: the
 * table has no counselor SELECT policy at all, so every read here is the
 * signed-in client reading their own days. The counselor's path is a separate
 * function that emits only the metrics this client marked as shared.
 */

type CheckinRow = {
  id: string;
  checkin_date: string;
  wellbeing: number | null;
  energy: number | null;
  mood: number | null;
  digestion: number | null;
  sleep_minutes: number | null;
  sleep_quality: number | null;
  alcohol_units: number | string | null;
};

const CHECKIN_COLUMNS =
  "id,checkin_date,wellbeing,energy,mood,digestion,sleep_minutes,sleep_quality,alcohol_units";

function resolveClient(supabase?: SupabaseClient) {
  return supabase ?? createBrowserSupabaseClient();
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("AUTH_REQUIRED");
  return data.user.id;
}

/** NULL stays undefined all the way up: it means unanswered, not zero. */
function optionalNumber(value: number | string | null): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapCheckinRow(row: CheckinRow): ClientCheckin {
  return {
    id: row.id,
    date: row.checkin_date,
    wellbeing: optionalNumber(row.wellbeing),
    energy: optionalNumber(row.energy),
    mood: optionalNumber(row.mood),
    digestion: optionalNumber(row.digestion),
    sleepMinutes: optionalNumber(row.sleep_minutes),
    sleepQuality: optionalNumber(row.sleep_quality),
    alcoholUnits: optionalNumber(row.alcohol_units),
  };
}

export async function fetchClientCheckin(
  date: string,
  supabase?: SupabaseClient,
): Promise<ClientCheckin | null> {
  const client = resolveClient(supabase);
  const { data, error } = await withTimeout(
    client.from("client_daily_checkins").select(CHECKIN_COLUMNS).eq("checkin_date", date).maybeSingle(),
    5000,
    "Supabase client check-in request timed out",
  );

  if (error) throw new Error(error.message);
  return data ? mapCheckinRow(data as unknown as CheckinRow) : null;
}

export async function fetchClientCheckins(
  range: { from: string; to: string },
  supabase?: SupabaseClient,
): Promise<ClientCheckin[]> {
  const client = resolveClient(supabase);
  const { data, error } = await withTimeout(
    client
      .from("client_daily_checkins")
      .select(CHECKIN_COLUMNS)
      .gte("checkin_date", range.from)
      .lte("checkin_date", range.to)
      .order("checkin_date", { ascending: true }),
    8000,
    "Supabase client check-in range request timed out",
  );

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CheckinRow[]).map(mapCheckinRow);
}

/**
 * What a client changed about a day, and nothing else.
 *
 * `undefined` leaves a value alone, `null` clears it back to unanswered. The
 * distinction is the whole point: someone correcting their sleep must not
 * silently wipe the wellbeing score they gave the same evening.
 */
export type ClientCheckinPatch = {
  wellbeing?: number | null;
  energy?: number | null;
  mood?: number | null;
  digestion?: number | null;
  sleepMinutes?: number | null;
  sleepQuality?: number | null;
  alcoholUnits?: number | null;
};

const PATCH_COLUMNS: Record<keyof ClientCheckinPatch, string> = {
  wellbeing: "wellbeing",
  energy: "energy",
  mood: "mood",
  digestion: "digestion",
  sleepMinutes: "sleep_minutes",
  sleepQuality: "sleep_quality",
  alcoholUnits: "alcohol_units",
};

/**
 * Upsert on `(client_user_id, checkin_date)`: only the patched columns end up
 * in the conflict update, so a second field written later joins the row rather
 * than replacing it. Any past date is allowed — a day filled in a week late is
 * worth exactly as much as one filled the same evening, and refusing it only
 * produces holes.
 */
export async function saveClientCheckin(
  date: string,
  patch: ClientCheckinPatch,
  supabase?: SupabaseClient,
): Promise<ClientCheckin> {
  const client = resolveClient(supabase);
  const userId = await requireUserId(client);

  const row: Record<string, unknown> = { client_user_id: userId, checkin_date: date };
  for (const [key, column] of Object.entries(PATCH_COLUMNS)) {
    const value = patch[key as keyof ClientCheckinPatch];
    if (value !== undefined) row[column] = value;
  }

  const { data, error } = await client
    .from("client_daily_checkins")
    .upsert(row, { onConflict: "client_user_id,checkin_date", ignoreDuplicates: false })
    .select(CHECKIN_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapCheckinRow(data as unknown as CheckinRow);
}

type PreferenceRow = {
  metric_key: string;
  tracked: boolean;
  shown: boolean;
  shared: boolean;
};

/**
 * Only the rows where this client departed from a registry default exist, so
 * an empty result is the normal case and means "everything as declared".
 */
export async function fetchClientMetricPreferences(
  supabase?: SupabaseClient,
): Promise<ClientMetricPreferenceRow[]> {
  const client = resolveClient(supabase);
  const { data, error } = await withTimeout(
    client.from("client_metric_preferences").select("metric_key,tracked,shown,shared"),
    5000,
    "Supabase client metric preferences request timed out",
  );

  if (error) throw new Error(error.message);
  return ((data ?? []) as PreferenceRow[]).map((row) => ({
    metricKey: row.metric_key,
    tracked: row.tracked,
    shown: row.shown,
    shared: row.shared,
  }));
}

/**
 * Writes the full triple for one metric.
 *
 * All three switches are stored together because the row only exists to record
 * a deviation, and a half-written row would leave the other two switches
 * silently tracking a default the client already moved away from.
 */
export async function saveClientMetricPreference(
  metricKey: string,
  preference: { tracked: boolean; shown: boolean; shared: boolean },
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  const userId = await requireUserId(client);

  const { error } = await client.from("client_metric_preferences").upsert(
    {
      client_user_id: userId,
      metric_key: metricKey,
      tracked: preference.tracked,
      shown: preference.shown,
      shared: preference.shared,
    },
    { onConflict: "client_user_id,metric_key", ignoreDuplicates: false },
  );

  if (error) throw new Error(error.message);
}

/**
 * The counselor's read. Never touches `client_daily_checkins` directly.
 *
 * The function decides everything: whether the link is active with
 * `consent_wellbeing`, and which metrics this client left shared. Long format
 * means a metric that was not shared is simply absent — there is no field here
 * that could be forgotten and rendered.
 */
export async function fetchClientWellbeingSeries(
  patientId: string,
  range: { from: string; to: string },
  supabase?: SupabaseClient,
): Promise<Map<string, { date: string; value: number }[]>> {
  const client = resolveClient(supabase);
  const { data, error } = await withTimeout(
    client.rpc("client_wellbeing_series", {
      target_patient: patientId,
      from_date: range.from,
      to_date: range.to,
    }),
    8000,
    "Supabase client wellbeing series request timed out",
  );

  if (error) throw new Error(error.message);

  const byMetric = new Map<string, { date: string; value: number }[]>();
  for (const row of (data ?? []) as { checkin_date: string; metric_key: string; value: number | string }[]) {
    const series = byMetric.get(row.metric_key) ?? [];
    series.push({ date: row.checkin_date, value: Number(row.value) });
    byMetric.set(row.metric_key, series);
  }
  return byMetric;
}
