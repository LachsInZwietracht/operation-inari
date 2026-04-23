import { expect, test } from "@playwright/test";

test.describe("Performance & Validation", () => {
  test("renders validation reference instead of fake live telemetry", async ({ page }) => {
    await page.goto("/leistung");

    await expect(page.getByRole("heading", { name: "Leistung & Validierung" })).toBeVisible();
    await expect(page.getByText("Keine Live-Metriken aus Produktions- oder Preview-Telemetrie")).toBeVisible();
    await expect(page.getByText("Automatisierte Checks")).toBeVisible();
    await expect(page.getByText("Benchmark-Ziele", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Hotspots", { exact: true })).toBeVisible();
  });

  test("lists automated validation workflows and benchmark goals", async ({ page }) => {
    await page.goto("/leistung");

    await expect(page.getByText("Automatisierte Validierung")).toBeVisible();
    await expect(page.getByText("npm run typecheck")).toBeVisible();
    await expect(page.getByText("npx playwright test tests/api-export.spec.ts tests/performance.spec.ts")).toBeVisible();
    await expect(page.getByText("npm run validate:nutrients")).toBeVisible();

    await expect(page.getByText("Beispiel LCP Dashboard")).toBeVisible();
    await expect(page.getByText("Foods Browser Antwort")).toBeVisible();
    await expect(page.getByText("Berichtsexport Fertigstellung")).toBeVisible();
  });

  test("shows hotspot notes and manual verification routes", async ({ page }) => {
    await page.goto("/leistung");

    await expect(page.getByText("Hotspots fuer Regressionen")).toBeVisible();
    await expect(page.getByText("Lebensmittel-Suche und Browser")).toBeVisible();
    await expect(page.getByText("Export- und Berichtspipeline")).toBeVisible();
    await expect(page.getByText("Rezept- und Planaggregation")).toBeVisible();

    await expect(page.getByText("Manuelle Verifikation", { exact: true })).toBeVisible();
    await expect(page.getByText("/api-export", { exact: true })).toBeVisible();
    await expect(page.getByText("/datenbank", { exact: true })).toBeVisible();
    await expect(page.getByText("/wissen", { exact: true })).toBeVisible();
  });

  test("navigates to Leistung via sidebar", async ({ page }) => {
    await page.goto("/dashboard");

    const sidebar = page.locator("[data-slot='sidebar-container']");
    await sidebar.getByRole("link", { name: "Leistung" }).click();

    await expect(page).toHaveURL(/\/leistung/);
    await expect(page.getByRole("heading", { name: "Leistung & Validierung" })).toBeVisible();
  });
});
