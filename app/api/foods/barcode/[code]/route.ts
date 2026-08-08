import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/auth";
import { toErrorResponse } from "@/lib/api/errors";
import {
  barcodeLookupCandidates,
  hasValidCheckDigit,
  isPlausibleBarcode,
  normalizeBarcode,
} from "@/lib/barcode";
import type { BarcodeLookupResult } from "@/lib/barcode";
import { fetchOffProduct, toLiveOffProduct } from "@/lib/off-product";
import { createClient } from "@/lib/supabase/server";

/**
 * Barcode → loggable product, in three tiers.
 *
 *   1. our catalog   `foods.source_food_id` holds the barcode for OFF imports,
 *                    so the existing unique index answers this directly — no
 *                    mapping table involved
 *   2. the OFF API   for the ~58% of German products the catalog pruning
 *                    dropped, gated on nutrition quality
 *   3. nothing       the client falls back to manual entry
 *
 * Tier 2 runs server-side on purpose: it keeps the identifying User-Agent that
 * OFF asks for, survives CORS, and means an OFF outage degrades to "unknown"
 * here instead of throwing inside the scanner on someone's phone.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    await requireApiUser();
  } catch (error) {
    return toErrorResponse(error);
  }

  const { code: rawCode } = await params;
  const barcode = normalizeBarcode(rawCode);

  // The three rejections stay distinct so the UI can say "vertippt?" rather
  // than "unbekannt" — a bad check digit is a different problem for the person
  // holding the product than a code nobody has ever registered.
  if (!barcode) {
    return json({ status: "invalid", reason: "format" }, 400);
  }
  if (!hasValidCheckDigit(barcode)) {
    return json({ status: "invalid", reason: "check_digit" }, 400);
  }
  if (!isPlausibleBarcode(barcode)) {
    return json({ status: "invalid", reason: "implausible" }, 400);
  }

  try {
    const catalogHit = await findInCatalog(barcode);
    if (catalogHit) {
      return json({ status: "catalog", barcode, food: catalogHit }, 200, CACHE_HIT);
    }

    const offProduct = await fetchOffProduct(barcode);
    const product = offProduct ? toLiveOffProduct(offProduct) : null;
    if (product) {
      return json({ status: "external", barcode, product }, 200, CACHE_HIT);
    }

    // Not cached: OFF gains products daily, and a client who scans the same
    // unknown item next week should get the new answer.
    return json({ status: "unknown", barcode }, 200);
  } catch (error) {
    console.error("GET /api/foods/barcode error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/** Private: a lookup result is tied to the requesting session's visibility. */
const CACHE_HIT = "private, max-age=3600";

function json(body: BarcodeLookupResult, status: number, cacheControl?: string) {
  return NextResponse.json(body, {
    status,
    headers: cacheControl ? { "Cache-Control": cacheControl } : undefined,
  });
}

/**
 * The catalog tier. Queried through the RLS-scoped client rather than the
 * service role: OFF foods are public by policy (`foods_read_public`), so there
 * is nothing to bypass, and a scan can never reach another tenant's custom
 * food this way.
 */
async function findInCatalog(barcode: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("foods")
    .select("id,name,manufacturer")
    .eq("data_source_id", "off")
    .in("source_food_id", barcodeLookupCandidates(barcode))
    .limit(1);

  if (error) throw new Error(error.message);

  const row = data?.[0];
  return row ? { id: row.id, name: row.name, manufacturer: row.manufacturer ?? null } : null;
}
