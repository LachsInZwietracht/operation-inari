import { expect, test } from "@playwright/test";

test.describe("Performance & Validation", () => {
  test("displays KPI cards with metrics", async ({ page }) => {
    await page.goto("/leistung");

    await expect(
      page.getByRole("heading", { name: "Leistung & Validierung" })
    ).toBeVisible();

    // KPI cards should render
    await expect(page.getByText("Antwortzeit")).toBeVisible();
    await expect(page.getByText("Durchsatz")).toBeVisible();
    await expect(page.getByText("Cache-Trefferrate")).toBeVisible();
    await expect(page.getByText("DB-Abfragezeit")).toBeVisible();
    await expect(page.getByText("Fehlerrate")).toBeVisible();
    await expect(page.getByText("Verfügbarkeit")).toBeVisible();
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
    await expect(page.getByText("Systemressourcen")).toBeVisible();
    await expect(page.getByText("CPU")).toBeVisible();
    await expect(page.getByText("RAM")).toBeVisible();
    await expect(page.getByText("Speicher")).toBeVisible();
    await expect(page.getByText("Netzwerk")).toBeVisible();

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
