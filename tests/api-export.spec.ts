import { expect, test } from "@playwright/test";

test.describe("API & Export", () => {
  test("displays export cards and creates a real CSV export", async ({ page }) => {
    await page.goto("/api-export");

    await expect(
      page.getByRole("heading", { name: "API & Export" })
    ).toBeVisible();

    // Export tab should be active by default with three format cards
    await expect(page.getByText("CSV-Export")).toBeVisible();
    await expect(page.getByText("JSON-Export")).toBeVisible();
    await expect(page.getByText("PDF-Export")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.locator("[data-slot='card']", { hasText: "CSV-Export" })
      .getByRole("button", { name: "Exportieren" }).click();
    const file = await download;
    expect(await file.suggestedFilename()).toMatch(/lebensmittel-.*\.csv/);

    await page.getByRole("tab", { name: "Verlauf" }).click();
    await expect(page.getByText(/Einträge/)).toBeVisible();
    await expect(page.getByRole("cell", { name: "Lebensmittel" }).first()).toBeVisible();
  });

  test("displays import drop zone and triggers import", async ({ page }) => {
    await page.goto("/api-export");

    await expect(page.getByText("Daten importieren")).toBeVisible();
    await expect(page.getByText("Datei hierhin ziehen")).toBeVisible();

    // Click the drop zone to trigger import
    await page.getByText("Datei hierhin ziehen").click();
    await expect(page.getByText("Import wird verarbeitet")).toBeVisible();
  });

  test("shows API keys with reveal toggle and endpoint explorer", async ({ page }) => {
    await page.goto("/api-export");

    // Switch to REST API tab
    await page.getByRole("tab", { name: "REST API" }).click();

    // API keys table should show
    const apiKeysTable = page.locator('[data-testid="api-keys-table"]');
    await expect(apiKeysTable.getByRole("cell", { name: "Produktion" })).toBeVisible();
    await expect(apiKeysTable.getByRole("cell", { name: "Entwicklung" })).toBeVisible();
    await expect(apiKeysTable.getByText("pk_live_****a8f3", { exact: true })).toBeVisible();

    // API endpoints table should show
    const apiEndpointsTable = page.locator('[data-testid="api-endpoints-table"]');
    const foodsRow = apiEndpointsTable.getByRole("row", { name: /\/api\/v1\/foods\s/ });
    const recipesRow = apiEndpointsTable.getByRole("row", { name: /\/api\/v1\/recipes\s/ });
    await expect(foodsRow).toBeVisible();
    await expect(recipesRow).toBeVisible();

    // Click on an endpoint to expand the sample response
    await foodsRow.click();
    await expect(page.getByText("Beispiel-Antwort")).toBeVisible();
    await expect(page.getByText('"food_karotte"')).toBeVisible();
  });

  test("toggles integrations and shows webhook table", async ({ page }) => {
    await page.goto("/api-export");

    // Switch to Integrationen tab
    await page.getByRole("tab", { name: "Integrationen" }).click();

    // Integration cards should show
    await expect(page.getByText("EHR/FHIR Schnittstelle")).toBeVisible();
    await expect(page.getByText("DEBInet Import")).toBeVisible();

    // Webhook table should display entries
    await expect(page.getByText("Webhooks", { exact: true })).toBeVisible();
    await expect(page.getByText("patient.created")).toBeVisible();
    await expect(page.getByText("protocol.submitted")).toBeVisible();
  });

  test("filters real export history", async ({ page }) => {
    await page.goto("/api-export");

    const download = page.waitForEvent("download");
    await page.locator("[data-slot='card']", { hasText: "PDF-Export" })
      .getByRole("button", { name: "Exportieren" }).click();
    await download;

    // Switch to Verlauf tab
    await page.getByRole("tab", { name: "Verlauf" }).click();

    await expect(page.getByText(/Einträge/)).toBeVisible();

    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "PDF" }).click();
    await expect(page.getByRole("cell", { name: "Patienten" }).first()).toBeVisible();
  });
});
