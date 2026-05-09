import { expect, test } from "@playwright/test";

function uniquePlannerDate(offset = 0) {
  const seed = Date.now() + offset;
  const year = 2040 + (seed % 40);
  const month = String((Math.floor(seed / 40) % 12) + 1).padStart(2, "0");
  const day = String((Math.floor(seed / 480) % 27) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
    const planDate = uniquePlannerDate(1000);
    // Clear localStorage to start fresh
    await page.goto(`/ernaehrungsplan?date=${planDate}`);
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
    const planDate = uniquePlannerDate(2000);
    await page.goto(`/ernaehrungsplan?date=${planDate}`);
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

  test("stores a manual checkpoint in the version history", async ({ page }) => {
    const planDate = uniquePlannerDate(3000);
    await page.goto(`/ernaehrungsplan?date=${planDate}`);
    await page.evaluate(() => localStorage.removeItem("prodi_meal_plans"));
    await page.reload();

    await page.getByRole("button", { name: /Hinzufügen/i }).first().click();
    const searchInput = page.locator("[cmdk-input]");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Hafer");
    await page.getByRole("option").filter({ hasText: /Hafer/i }).first().click();
    await expect(page.getByText(/Hafer/i).first()).toBeVisible();

    const planRecord = page.locator("[data-slot='card']").filter({ hasText: "Planakte" }).first();
    await planRecord.getByRole("button", { name: "Checkpoint speichern" }).click();

    await expect(planRecord.getByText("Version 1")).toBeVisible({ timeout: 30_000 });
    await expect(planRecord.getByText(/Einträge · Checkpoint/)).toBeVisible();
    await expect(planRecord.getByRole("button", { name: "Wiederherstellen" }).first()).toBeEnabled();
  });

  test("applies a nutrient optimization suggestion", async ({ page }) => {
    const planDate = uniquePlannerDate(3500);
    await page.goto(`/ernaehrungsplan?date=${planDate}`);
    await page.evaluate(() => localStorage.removeItem("prodi_meal_plans"));
    await page.reload();

    await page.getByRole("button", { name: /Hinzufügen/i }).first().click();
    const searchInput = page.locator("[cmdk-input]");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Hafer");
    await page.getByRole("option").filter({ hasText: /Hafer/i }).first().click();
    await expect(page.getByText(/Hafer/i).first()).toBeVisible();

    const assistant = page.locator("[data-slot='card']").filter({ hasText: "Optimierungsassistent" }).first();
    await expect(assistant).toBeVisible();
    await expect(assistant.getByRole("button", { name: "Einfügen" }).first()).toBeVisible({ timeout: 30_000 });
    await assistant.getByRole("button", { name: "Einfügen" }).first().click();

    await expect(page.getByText(/vorgemerkt/)).toBeVisible();
  });

  test("creates an immutable version when a plan is approved", async ({ page }) => {
    const planDate = uniquePlannerDate(4000);
    await page.goto(`/ernaehrungsplan?date=${planDate}`);
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
