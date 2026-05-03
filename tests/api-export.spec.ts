import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fetchLatestAccessAuditLog(action: string, targetId: string) {
  const { data, error } = await admin
    .from("access_audit_logs")
    .select("action,target_type,target_id,metadata")
    .eq("action", action)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

test.describe("API & Export", () => {
  test("displays export cards and creates a real CSV export", async ({ page }) => {
    await page.goto("/api-export");

    await expect(page.getByRole("heading", { name: "API & Export" })).toBeVisible();
    await expect(page.getByText("Exporte insgesamt")).toBeVisible();
    await expect(page.getByText("CSV-Export")).toBeVisible();
    await expect(page.getByText("JSON-Export")).toBeVisible();
    await expect(page.getByText("PDF-Export", { exact: true })).toBeVisible();

    const download = page.waitForEvent("download");
    await page.locator("[data-slot='card']", { hasText: "CSV-Export" }).getByRole("button", { name: "Exportieren" }).click();
    const file = await download;
    const fileName = await file.suggestedFilename();
    expect(fileName).toMatch(/lebensmittel-.*\.csv/);

    await expect.poll(async () => fetchLatestAccessAuditLog("dataset_export_created", fileName)).toMatchObject({
      action: "dataset_export_created",
      target_type: "export_job",
      target_id: fileName,
      metadata: expect.objectContaining({
        scope: "Lebensmittel",
        format: "CSV",
        fileName,
      }),
    });

    await page.getByRole("tab", { name: "Verlauf" }).click();
    await expect(page.getByText(/Eintraege/)).toBeVisible();
    await expect(page.getByRole("cell", { name: "Lebensmittel" }).first()).toBeVisible();
  });

  test("marks import as planned instead of pretending to process uploads", async ({ page }) => {
    await page.goto("/api-export");

    await expect(page.getByText("Datenimport")).toBeVisible();
    await expect(page.getByText("Geplant")).toBeVisible();
    await expect(page.getByText(/Import-Backend ist .* noch nicht implementiert/)).toBeVisible();
  });

  test("shows REST API as preview with expandable endpoint examples", async ({ page }) => {
    await page.goto("/api-export");

    await page.getByRole("tab", { name: "REST API" }).click();

    await expect(page.getByText("REST API Vorschau")).toBeVisible();
    await expect(page.getByText("Keine live verwalteten API-Schluessel")).toBeVisible();

    const apiEndpointsTable = page.locator('[data-testid="api-endpoints-table"]');
    const foodsRow = apiEndpointsTable.getByRole("row", { name: /\/api\/v1\/foods\s/ });
    const recipesRow = apiEndpointsTable.getByRole("row", { name: /\/api\/v1\/recipes\s/ });
    await expect(foodsRow).toBeVisible();
    await expect(recipesRow).toBeVisible();

    await foodsRow.click();
    await expect(page.getByText("Beispielantwort (Preview)")).toBeVisible();
    await expect(page.getByText('"food_karotte"')).toBeVisible();
  });

  test("shows integrations and webhook events as preview", async ({ page }) => {
    await page.goto("/api-export");

    await page.getByRole("tab", { name: "Integrationen" }).click();

    await expect(page.getByText("Integrationsvorschau", { exact: true })).toBeVisible();
    await expect(page.getByText("EHR/FHIR Schnittstelle")).toBeVisible();
    await expect(page.getByText("DEBInet Import")).toBeVisible();
    await expect(page.getByText("Webhook-Ereignisse")).toBeVisible();
    await expect(page.getByText("patient.created")).toBeVisible();
    await expect(page.getByText("protocol.submitted")).toBeVisible();
  });

  test("filters real export history", async ({ page }) => {
    await page.goto("/api-export");

    const download = page.waitForEvent("download");
    await page.locator("[data-slot='card']", { hasText: "PDF-Export" }).getByRole("button", { name: "Exportieren" }).click();
    await download;

    await page.getByRole("tab", { name: "Verlauf" }).click();
    await expect(page.getByText(/Eintraege/)).toBeVisible();

    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "PDF" }).click();
    await expect(page.getByRole("cell", { name: "Patienten" }).first()).toBeVisible();
  });
});
