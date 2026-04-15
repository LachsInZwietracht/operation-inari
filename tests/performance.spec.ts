import { expect, test } from "@playwright/test";

test.describe("Performance & Validation", () => {
  test("displays KPI cards with metrics", async ({ page }) => {
    await page.goto("/leistung");

    await expect(
      page.getByRole("heading", { name: "Leistung & Validierung" })
    ).toBeVisible();

    const main = page.locator("main");

    // KPI cards should render
    await expect(main.getByText("Antwortzeit", { exact: true }).first()).toBeVisible();
    await expect(main.getByText("Durchsatz", { exact: true }).first()).toBeVisible();
    await expect(main.getByText("Cache-Trefferrate", { exact: true }).first()).toBeVisible();
    await expect(main.getByText("DB-Abfragezeit", { exact: true }).first()).toBeVisible();
    await expect(main.getByText("Fehlerrate", { exact: true }).first()).toBeVisible();
    await expect(main.getByText("Verfügbarkeit", { exact: true }).first()).toBeVisible();
  });

  test("shows response time chart", async ({ page }) => {
    await page.goto("/leistung");

    await expect(page.getByText("Antwortzeiten (24h)")).toBeVisible();
    // Recharts renders SVG — the container should exist
    await expect(page.locator(".recharts-responsive-container")).toBeVisible();
  });

  test("displays load test results table", async ({ page }) => {
    await page.goto("/leistung");

    await expect(page.getByText("Lasttest-Ergebnisse")).toBeVisible();

    // Table should show all test scenarios
    await expect(page.getByText("Basis-Last")).toBeVisible();
    await expect(page.getByText("Normal-Betrieb")).toBeVisible();
    await expect(page.getByText("Hohe Last")).toBeVisible();
    await expect(page.getByText("Spitzenlast")).toBeVisible();
    await expect(page.getByText("Stresstest").first()).toBeVisible();
  });

  test("runs stress test simulation with progress bar", async ({ page }) => {
    await page.goto("/leistung");

    // Stress test controls should show
    const stressSection = page.getByText("Simulieren Sie Last").locator("..");
    await expect(page.getByRole("button", { name: "Starten" })).toBeVisible();

    // Set a short duration for testing (10 seconds)
    await page.getByRole("button", { name: "Starten" }).click();

    // Progress bar should appear and the button should change to "Abbrechen"
    await expect(page.getByRole("button", { name: "Abbrechen" })).toBeVisible();
    await expect(page.getByText("Test läuft…")).toBeVisible();

    // Cancel the test
    await page.getByRole("button", { name: "Abbrechen" }).click();
    await expect(page.getByRole("button", { name: "Starten" })).toBeVisible();
  });

  test("shows system resources and database query stats", async ({ page }) => {
    await page.goto("/leistung");

    // System resources card
    const systemCard = page.locator("main");
    await expect(page.getByText("Systemressourcen", { exact: true })).toBeVisible();
    await expect(systemCard.getByText("CPU", { exact: true }).first()).toBeVisible();
    await expect(systemCard.getByText("RAM", { exact: true }).first()).toBeVisible();
    await expect(systemCard.getByText("Speicher", { exact: true }).first()).toBeVisible();
    await expect(systemCard.getByText("Netzwerk", { exact: true }).first()).toBeVisible();

    // Database stats
    await expect(page.getByText("Datenbankabfragen")).toBeVisible();
    await expect(page.getByText("Lebensmittel-Suche")).toBeVisible();
    await expect(page.getByText("Nährstoff-Aggregation")).toBeVisible();
    await expect(page.getByText("Rezept-Zusammenführung")).toBeVisible();
  });

  test("navigates to Leistung via sidebar", async ({ page }) => {
    await page.goto("/dashboard");

    const sidebar = page.locator("[data-slot='sidebar-container']");
    await sidebar.getByRole("link", { name: "Leistung" }).click();

    await expect(page).toHaveURL(/\/leistung/);
    await expect(
      page.getByRole("heading", { name: "Leistung & Validierung" })
    ).toBeVisible();
  });
});
