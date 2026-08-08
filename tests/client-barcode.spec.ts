import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  barcodeLookupCandidates,
  hasValidCheckDigit,
  isPlausibleBarcode,
  normalizeBarcode,
} from "@/lib/barcode";
import { toLiveOffProduct } from "@/lib/off-product";

/**
 * Barcode lookup.
 *
 * The Open Food Facts tier is covered through `toLiveOffProduct` with fixture
 * payloads rather than by calling OFF: a spec that depends on a third-party
 * service tells you about their uptime, not about our code. What is asserted
 * against the real API route is the catalog tier and the rejections, both of
 * which are entirely ours.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Verified GTIN-13 check digits — the fixtures depend on these being real.
const VALID_BARCODE = "4008400401027";
const MISTYPED_BARCODE = "4008400401026";

test.describe("barcode helpers", () => {
  test("normalizes what scanners and humans produce", () => {
    expect(normalizeBarcode(" 4008400 401027 ")).toBe(VALID_BARCODE);
    expect(normalizeBarcode("4008-4004-01027")).toBe(VALID_BARCODE);
    expect(normalizeBarcode("40084004010")).toBeNull(); // 11 digits is no GTIN
    expect(normalizeBarcode("Haferflocken")).toBeNull();
  });

  test("catches a mistyped digit before a lookup runs", () => {
    expect(hasValidCheckDigit(VALID_BARCODE)).toBe(true);
    expect(hasValidCheckDigit(MISTYPED_BARCODE)).toBe(false);
    expect(hasValidCheckDigit("40123455")).toBe(true); // GTIN-8
  });

  test("rejects codes that are never a food product", () => {
    expect(isPlausibleBarcode("9783161484100")).toBe(false); // ISBN
    expect(isPlausibleBarcode("0000000000000")).toBe(false);
    expect(isPlausibleBarcode(VALID_BARCODE)).toBe(true);
    // In-store codes for weighed goods stay allowed: OFF carries them.
    expect(isPlausibleBarcode("2813810016240")).toBe(true);
  });

  test("looks for the zero-padded and unpadded form of the same product", () => {
    const candidates = barcodeLookupCandidates("036000291452");
    expect(candidates).toContain("036000291452");
    expect(candidates).toContain("0036000291452");
    expect(candidates).toContain("00036000291452");
  });
});

test.describe("Open Food Facts payloads", () => {
  const goodProduct = {
    code: VALID_BARCODE,
    product_name: "Nuss-Nougat-Creme",
    brands: "Ferrero",
    nutriments: {
      "energy-kcal_100g": 539,
      proteins_100g: 6.3,
      fat_100g: 30.9,
      carbohydrates_100g: 57.5,
      sugars_100g: 56.3,
    },
  };

  test("maps a usable product onto our nutrient ids", () => {
    const product = toLiveOffProduct(goodProduct);
    expect(product).not.toBeNull();
    expect(product!.name).toBe("Nuss-Nougat-Creme");
    expect(product!.brand).toBe("Ferrero");

    const byId = new Map(product!.nutrients.map((n) => [n.nutrientId, n.amount]));
    expect(byId.get("energie")).toBe(539);
    expect(byId.get("eiweiss")).toBe(6.3);
    expect(byId.get("kohlenhydrate")).toBe(57.5);
  });

  test("rejects a product with no nutrition at all", () => {
    // The real trigger for this gate: OFF answers 200 with a named product
    // whose nutriments are empty, which would enter a diary as 0 kcal.
    expect(toLiveOffProduct({ code: VALID_BARCODE, product_name: "nutella" })).toBeNull();
  });

  test("rejects energy without macros", () => {
    expect(
      toLiveOffProduct({
        code: VALID_BARCODE,
        product_name: "Nur Energie",
        nutriments: { "energy-kcal_100g": 250 },
      }),
    ).toBeNull();
  });

  test("rejects values that cannot be per 100 g", () => {
    expect(
      toLiveOffProduct({
        code: VALID_BARCODE,
        product_name: "Kaputt",
        nutriments: {
          "energy-kcal_100g": 500,
          proteins_100g: 60,
          fat_100g: 40,
          carbohydrates_100g: 50,
        },
      }),
    ).toBeNull();
  });

  test("rejects data the source reports per serving", () => {
    expect(
      toLiveOffProduct({
        code: VALID_BARCODE,
        product_name: "Portionsangabe",
        nutrition_data_per: "serving",
        nutriments: {
          "energy-kcal_100g": 250,
          proteins_100g: 5,
          fat_100g: 5,
          carbohydrates_100g: 30,
        },
      }),
    ).toBeNull();
  });
});

test.describe("barcode lookup route", () => {
  let foodId: string | undefined;

  test.beforeAll(async () => {
    await admin
      .from("data_sources")
      .upsert({ id: "off", name: "Open Food Facts", version: "test" }, { onConflict: "id" });

    const { data, error } = await admin
      .from("foods")
      .upsert(
        {
          data_source_id: "off",
          source_food_id: VALID_BARCODE,
          name: "Barcode-Testprodukt",
          manufacturer: "Testmarke",
          is_branded: true,
          is_custom: false,
        },
        { onConflict: "data_source_id,source_food_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    foodId = data.id;
  });

  test.afterAll(async () => {
    if (foodId) await admin.from("foods").delete().eq("id", foodId);
  });

  test("resolves a barcode the catalog knows", async ({ request }) => {
    const response = await request.get(`/api/foods/barcode/${VALID_BARCODE}`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("catalog");
    expect(body.food.name).toBe("Barcode-Testprodukt");
    expect(body.food.id).toBe(foodId);
  });

  test("tells a typo apart from an unknown product", async ({ request }) => {
    const response = await request.get(`/api/foods/barcode/${MISTYPED_BARCODE}`);
    expect(response.status()).toBe(400);
    expect((await response.json()).reason).toBe("check_digit");
  });

  test("refuses a code that is not a GTIN", async ({ request }) => {
    const response = await request.get("/api/foods/barcode/12345");
    expect(response.status()).toBe(400);
    expect((await response.json()).reason).toBe("format");
  });

  test("refuses an ISBN", async ({ request }) => {
    const response = await request.get("/api/foods/barcode/9783161484100");
    expect(response.status()).toBe(400);
    expect((await response.json()).reason).toBe("implausible");
  });
});
