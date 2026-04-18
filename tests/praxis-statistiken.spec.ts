import { expect, test, type Page } from "@playwright/test";

async function openPraxisStatistiken(page: Page) {
  await page.goto("/praxis-statistiken", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Praxis-Statistiken" })).toBeVisible({ timeout: 30_000 });
}

test.describe("Praxis-Statistiken", () => {
  test("displays 4 dynamic KPI cards", async ({ page }) => {
    await openPraxisStatistiken(page);

    await expect(page.locator("[data-slot='card-title']", { hasText: "Aktive Patienten" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Sitzungen (Monat)" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Ø Sitzungsdauer" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Umsatz (Monat)" })).toBeVisible();
  });

  test("displays time-range filter tabs and allows switching", async ({ page }) => {
    await openPraxisStatistiken(page);

    const tabList = page.getByRole("tablist");
    await expect(tabList).toBeVisible();

    await expect(page.getByRole("tab", { name: "Dieser Monat" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Letzte 3 Monate" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Dieses Jahr" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Gesamt" })).toBeVisible();

    // Switch tabs without crashing
    await page.getByRole("tab", { name: "Letzte 3 Monate" }).click();
    await expect(page.getByRole("tab", { name: "Letzte 3 Monate" })).toHaveAttribute("data-state", "active");

    await page.getByRole("tab", { name: "Dieses Jahr" }).click();
    await expect(page.getByRole("tab", { name: "Dieses Jahr" })).toHaveAttribute("data-state", "active");

    await page.getByRole("tab", { name: "Gesamt" }).click();
    await expect(page.getByRole("tab", { name: "Gesamt" })).toHaveAttribute("data-state", "active");

    await page.getByRole("tab", { name: "Dieser Monat" }).click();
    await expect(page.getByRole("tab", { name: "Dieser Monat" })).toHaveAttribute("data-state", "active");
  });

  test("renders chart sections", async ({ page }) => {
    await openPraxisStatistiken(page);

    await expect(page.locator("[data-slot='card-title']", { hasText: "Timeline Terminvolumen" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Leistungsauslastung" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Mix der Termine" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Monatlicher Umsatz" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Statistische Kennzahlen" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Umsatz & Risiken" })).toBeVisible();
  });

  test("renders patient demographics section", async ({ page }) => {
    await openPraxisStatistiken(page);

    await expect(page.locator("[data-slot='card-title']", { hasText: "Geschlechterverteilung" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Top Indikationen" })).toBeVisible();
    await expect(page.locator("[data-slot='card-title']", { hasText: "Neuzugänge" })).toBeVisible();
  });

  test("displays warnings section", async ({ page }) => {
    await openPraxisStatistiken(page);

    await expect(page.locator("[data-slot='card-title']", { hasText: "Warnungen" })).toBeVisible();
  });
});
