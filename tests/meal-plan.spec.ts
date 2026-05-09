import { expect, test } from "@playwright/test";

test.describe("Ernährungsplan", () => {
  test.setTimeout(60_000);

  test("displays meal slots and allows date navigation", async ({ page }) => {
    await page.goto("/ernaehrungsplan");

    await expect(page.locator("main").getByRole("heading", { name: "Ernährungsplan" })).toBeVisible();

    // Should show meal slot card titles (use data-slot to avoid strict mode violations)
    await expect(page.locator('[data-slot="card-title"]', { hasText: "Frühstück" })).toBeVisible();
    await expect(page.locator('[data-slot="card-title"]', { hasText: "Mittagessen" })).toBeVisible();
    await expect(page.locator('[data-slot="card-title"]', { hasText: "Abendessen" })).toBeVisible();

    // Just verify date is displayed (any German date format)
    await expect(page.locator("text=/\\d{1,2}\\./").first()).toBeVisible();
  });

  test("adds food entry to a meal slot", async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto("/ernaehrungsplan");
    await page.evaluate(() => localStorage.removeItem("prodi_meal_plans"));
    await page.reload();

    // Click "Hinzufügen" on the first slot (Frühstück)
    const addButtons = page.getByRole("button", { name: /Hinzufügen/i });
    await addButtons.first().click();

    // Search dialog should open — use the cmdk search input specifically
    const searchInput = page.locator('[cmdk-input]');
    await expect(searchInput).toBeVisible();

    // Search for a food
    await searchInput.fill("Hafer");

    // Select a food from results
    await page.getByRole("option").filter({ hasText: /Hafer/i }).first().click();

    // The entry should now appear in the slot
    await expect(page.getByText(/Hafer/i).first()).toBeVisible();

    await page.evaluate(() => localStorage.removeItem("prodi_meal_plans"));
    await page.reload();

    await expect(page.getByText(/Hafer/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test("exports the current plan as a clinical PDF", async ({ page }) => {
    await page.goto("/ernaehrungsplan");
    await page.evaluate(() => localStorage.removeItem("prodi_meal_plans"));
    await page.reload();

    await page.getByRole("button", { name: /Hinzufügen/i }).first().click();
    const searchInput = page.locator("[cmdk-input]");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Hafer");
    await page.getByRole("option").filter({ hasText: /Hafer/i }).first().click();
    await expect(page.getByText(/Hafer/i).first()).toBeVisible();

    await page.getByRole("button", { name: "Plan exportieren" }).click();
    const pdfDownload = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /Klinischer Bericht/ }).click();
    const pdf = await pdfDownload;

    expect(await pdf.suggestedFilename()).toMatch(/ernaehrungsplan-klinik-.*\.pdf/);
  });

  test("creates an immutable version when a plan is approved", async ({ page }) => {
    const day = String(Math.floor(Math.random() * 20) + 1).padStart(2, "0");
    await page.goto(`/ernaehrungsplan?date=2031-02-${day}`);
    await page.evaluate(() => localStorage.removeItem("prodi_meal_plans"));
    await page.reload();

    await page.getByRole("button", { name: /Hinzufügen/i }).first().click();
    const searchInput = page.locator("[cmdk-input]");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Hafer");
    await page.getByRole("option").filter({ hasText: /Hafer/i }).first().click();
    await expect(page.getByText(/Hafer/i).first()).toBeVisible();

    const planRecord = page.locator("[data-slot='card']").filter({ hasText: "Planakte" }).first();
    await planRecord.getByRole("combobox").click();
    await page.getByRole("option", { name: "Freigegeben" }).click();

    await expect(planRecord.getByText("Bearbeitung")).toBeVisible();
    await expect(planRecord.getByText("Version 1")).toBeVisible({ timeout: 30_000 });
    await expect(planRecord.getByRole("button", { name: "Wiederherstellen" }).first()).toBeDisabled();
  });
});
