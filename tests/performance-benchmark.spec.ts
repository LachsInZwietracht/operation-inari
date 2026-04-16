import { test, expect } from "@playwright/test";

test.describe("Performance & Speed Benchmark", () => {
  const TARGET_URL = process.env.BASE_URL || "http://localhost:3000";

  test("Benchmark: Initial Page Load (Dashboard)", async ({ page }) => {
    console.log(`\n🚀 Benchmarking: ${TARGET_URL}/dashboard`);
    
    const start = Date.now();
    await page.goto(`${TARGET_URL}/dashboard`);
    await page.waitForSelector("h1"); // Wait for header
    const end = Date.now();
    
    const duration = end - start;
    console.log(`⏱️  Initial Dashboard Load: ${duration}ms`);
    
    // Expert threshold: Dashboard should load within 3 seconds even with data
    expect(duration).toBeLessThan(3000);
  });

  test("Benchmark: Rezepte Page (Search Index Load)", async ({ page }) => {
    console.log(`\n🚀 Benchmarking: ${TARGET_URL}/rezepte`);
    
    const start = Date.now();
    await page.goto(`${TARGET_URL}/rezepte`);
    await page.waitForSelector("h1", { state: "visible" });
    const end = Date.now();
    
    const duration = end - start;
    console.log(`⏱️  Rezepte Page Load: ${duration}ms`);
    
    // Threshold: Rezepte page should be fast now with on-demand index
    expect(duration).toBeLessThan(2500);
  });

  test("Benchmark: Smart Food Search Latency", async ({ page }) => {
    await page.goto(`${TARGET_URL}/rezepte/neu`);
    await page.waitForSelector("button:has-text('Zutat hinzufügen')");
    
    console.log("\n🚀 Benchmarking: Smart Food Search Interaction");
    
    await page.click("button:has-text('Zutat hinzufügen')");
    const searchInput = page.locator("[cmdk-input]");
    await expect(searchInput).toBeVisible();
    
    const start = Date.now();
    await searchInput.fill("Apfel");
    
    // Wait for a result item to appear (indicates RPC or fuzzy search finished)
    await page.waitForSelector("[cmdk-item]");
    const end = Date.now();
    
    const duration = end - start;
    console.log(`⏱️  Food Search Response Time: ${duration}ms`);
    
    // Search should respond within 800ms for a "snappy" feel
    expect(duration).toBeLessThan(800);
  });
});
