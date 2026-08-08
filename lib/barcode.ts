import type { LiveOffProduct } from "@/lib/off-product";

/**
 * GTIN handling for the barcode lookup.
 *
 * Scanners and humans hand us the same product in different shapes: a scanned
 * UPC-A comes back as 12 digits, the catalog may hold the same product as a
 * 13-digit GTIN with a leading zero, and a typed code arrives with spaces or
 * dashes. Everything here exists to collapse those shapes onto the form the
 * catalog actually stores, before a single query runs.
 */

/** Longest GTIN; also the widest form we ever pad to. */
const MAX_GTIN_LENGTH = 14;

/**
 * What a lookup can conclude, and the contract between the API route and the
 * client. The three outcomes are deliberately distinct: a catalog hit becomes
 * a normal food entry the counselor can trace, an external hit becomes a
 * `custom` entry carrying its own nutrients, and an unknown code has to be
 * entered by hand. Collapsing them would hide from the client which of those
 * three they are looking at.
 */
export type BarcodeLookupResult =
  | { status: "catalog"; barcode: string; food: { id: string; name: string; manufacturer: string | null } }
  | { status: "external"; barcode: string; product: LiveOffProduct }
  | { status: "unknown"; barcode: string }
  | { status: "invalid"; reason: "format" | "check_digit" | "implausible" };

/**
 * Digits only, and only at a length a GTIN can have. Returns null for anything
 * else so callers never build a query from free text.
 */
export function normalizeBarcode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return digits;
  }
  return null;
}

/**
 * GTIN mod-10 check digit. The weights alternate 3/1 starting at the digit
 * next to the check digit, which makes the algorithm identical for GTIN-8,
 * -12, -13 and -14 as long as it is applied from the right.
 */
function computeCheckDigit(payload: string): number {
  let sum = 0;
  let weight = 3;
  for (let i = payload.length - 1; i >= 0; i--) {
    sum += Number(payload[i]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Catches misreads and typos before they cost a round trip. A wrong check
 * digit means the code was mistyped or the scan was garbled — not that the
 * product is unknown, and the two deserve different messages.
 */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d{8,14}$/.test(code)) return false;
  return computeCheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/**
 * Codes that are structurally valid but never a food product: repeated
 * digits and long zero runs are test codes, 978/979 is the ISBN range.
 *
 * Deliberately not rejected: the 2xxxxx range, which retailers assign
 * in-store for weighed goods. Those codes are not globally unique, but Open
 * Food Facts does carry them and so does our catalog, so a hit is better than
 * a blanket refusal.
 */
export function isPlausibleBarcode(code: string): boolean {
  if (!/^\d{8,14}$/.test(code)) return false;
  if (/^(\d)\1+$/.test(code)) return false;
  if (/^0{5,}/.test(code)) return false;
  if (/^97[89]/.test(code)) return false;
  return true;
}

/**
 * Every form the same product might be stored under.
 *
 * OFF imports keep the code as the source delivered it, so a GTIN-12 product
 * can sit in `foods.source_food_id` as 12 or 13 digits depending on the export
 * it came from. Querying the zero-padded and zero-stripped variants together
 * costs one indexed `IN` lookup instead of a guess.
 */
export function barcodeLookupCandidates(code: string): string[] {
  const candidates = new Set<string>();
  const stripped = code.replace(/^0+/, "") || "0";

  for (let length = stripped.length; length <= MAX_GTIN_LENGTH; length++) {
    if (length === 8 || length === 12 || length === 13 || length === 14) {
      candidates.add(stripped.padStart(length, "0"));
    }
  }

  candidates.add(code);
  return [...candidates];
}
