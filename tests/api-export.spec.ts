import { expect, test } from "@playwright/test";

test.describe("API & Export", () => {
  test("displays export cards and triggers CSV export", async ({ page }) => {
    await page.goto("/api-export");

    await expect(
      page.getByRole("heading", { name: "API & Export" })
    ).toBeVisible();

    // Export tab should be active by default with three format cards
    await expect(page.getByText("CSV-Export")).toBeVisible();
    await expect(page.getByText("JSON-Export")).toBeVisible();
    await expect(page.getByText("PDF-Export")).toBeVisible();

    // Select a scope and export
    await page.getByText("CSV-Export").closest("[data-slot='card']")!
      .getByRole("button", { name: "Exportieren" }).click();

    // Toast confirmation
    await expect(page.getByText("CSV-Export gestartet")).toBeVisible();
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
    await expect(page.getByText("Produktion")).toBeVisible();
    await expect(page.getByText("Entwicklung")).toBeVisible();
    await expect(page.getByText("pk_live_****a8f3")).toBeVisible();

    // API endpoints table should show
    await expect(page.getByText("API-Endpunkte")).toBeVisible();
    await expect(page.getByText("/api/v1/foods")).toBeVisible();
    await expect(page.getByText("/api/v1/recipes")).toBeVisible();

    // Click on an endpoint to expand the sample response
    await page.getByText("/api/v1/foods").first().click();
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
    await expect(page.getByText("Webhooks")).toBeVisible();
    await expect(page.getByText("patient.created")).toBeVisible();
    await expect(page.getByText("protocol.submitted")).toBeVisible();
  });

  test("filters export/import history", async ({ page }) => {
    await page.goto("/api-export");

    // Switch to Verlauf tab
    await page.getByRole("tab", { name: "Verlauf" }).click();

    // Should show history entries
    await expect(page.getByText("7 Einträge")).toBeVisible();

    // Filter by type "Import"
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Import" }).click();

    // Should filter down
    await expect(page.getByText("2 Einträge")).toBeVisible();
  });
});
