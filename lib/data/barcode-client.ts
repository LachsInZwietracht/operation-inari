import type { BarcodeLookupResult } from "@/lib/barcode";

/**
 * Resolves a barcode through the API route.
 *
 * Deliberately not a Supabase query: the lookup falls back to Open Food Facts,
 * which needs a server-side request, and keeping both tiers behind one call
 * means the caller handles one shape instead of branching on where the answer
 * came from.
 */
export async function lookupBarcode(code: string): Promise<BarcodeLookupResult> {
  const response = await fetch(`/api/foods/barcode/${encodeURIComponent(code)}`);

  if (response.status === 401) throw new Error("AUTH_REQUIRED");

  // 400 carries a real result (`invalid` with a reason), so only the 5xx range
  // and unparseable bodies count as failures.
  if (!response.ok && response.status !== 400) {
    throw new Error(`Barcode lookup failed with ${response.status}`);
  }

  return (await response.json()) as BarcodeLookupResult;
}
