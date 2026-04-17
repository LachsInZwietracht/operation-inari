import { expect, test, type Page } from "@playwright/test";

async function openAbrechnung(page: Page) {
  await page.goto("/abrechnung", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Abrechnung" })).toBeVisible({ timeout: 30_000 });
}

test.describe("Invoice Management", () => {
  test("displays invoice journal with mock data", async ({ page }) => {
    await openAbrechnung(page);

    // Verify the journal table is visible
    const table = page.locator("table").first();
    await expect(table).toBeVisible();

    // Verify mock invoice data appears
    await expect(page.getByRole("cell", { name: "Ernährungscoaching Paket" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Diabetes-Schulung" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Allergieberatung" })).toBeVisible();
  });

  test("displays KPI cards", async ({ page }) => {
    await openAbrechnung(page);

    await expect(page.locator("[data-slot='card-title']", { hasText: "Offene Beträge" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Überfällig / Mahnung" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Bezahlt" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Versicherer" })).toBeVisible();
  });

  test("creates a new invoice and verifies it appears in the journal", async ({ page }) => {
    await openAbrechnung(page);

    // Scroll to the invoice generator
    await page.getByRole("button", { name: "Neue Rechnung erfassen" }).click();

    // Fill the form using placeholder-based locators (labels aren't associated via htmlFor)
    const serviceInput = page.getByPlaceholder("z. B. Erstberatung");
    await serviceInput.clear();
    await serviceInput.fill("Erstberatung Testfall");

    const amountInput = page.getByRole("spinbutton");
    await amountInput.clear();
    await amountInput.fill("250");

    const dueDateInput = page.locator("input[type='date']");
    await dueDateInput.fill("2026-12-31");

    const insuranceInput = page.getByPlaceholder("z. B. TK");
    await insuranceInput.clear();
    await insuranceInput.fill("AOK Test");

    const notesInput = page.getByPlaceholder("z. B. Abrechnung nach §43 SGB");
    await notesInput.clear();
    await notesInput.fill("Testnotiz für E2E");

    // Submit the form
    await page.getByRole("button", { name: "Rechnung speichern" }).click();

    // Verify toast
    await expect(page.getByText("Rechnung erstellt")).toBeVisible({ timeout: 5_000 });

    // Verify the new invoice appears in the journal table
    await expect(page.getByRole("cell", { name: "Erstberatung Testfall" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "AOK Test" })).toBeVisible();
  });

  test("marks an invoice as paid", async ({ page }) => {
    await openAbrechnung(page);

    // Find the first row with "Offen" status and click "Bezahlt"
    const openRow = page.locator("table tbody tr").filter({ hasText: "Offen" }).first();
    await expect(openRow).toBeVisible({ timeout: 5_000 });

    const bezahltButton = openRow.getByRole("button", { name: "Bezahlt" });
    await bezahltButton.click();
    await expect(page.getByText("Rechnung als bezahlt markiert")).toBeVisible({ timeout: 5_000 });
  });

  test("triggers Mahnung for an open invoice", async ({ page }) => {
    await openAbrechnung(page);

    const openRow = page.locator("table tbody tr").filter({ hasText: "Offen" }).first();
    await expect(openRow).toBeVisible({ timeout: 5_000 });

    const mahnungButton = openRow.getByRole("button", { name: "Mahnung" });
    await mahnungButton.click();
    await expect(page.getByText("Mahnung ausgelöst")).toBeVisible({ timeout: 5_000 });
  });
});
