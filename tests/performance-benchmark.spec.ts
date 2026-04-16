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
    
    // Expert threshold: Dashboard should load within 2 seconds with Edge Cache
    expect(duration).toBeLessThan(2000);
  });

  test("Benchmark: Rezepte Page (Search Index Load)", async ({ page }) => {
    console.log(`\n🚀 Benchmarking: ${TARGET_URL}/rezepte`);
    
    const start = Date.now();
    await page.goto(`${TARGET_URL}/rezepte`);
    await page.waitForSelector("h1", { state: "visible" });
    const end = Date.now();
    
    const duration = end - start;
    console.log(`⏱️  Rezepte Page Load: ${duration}ms`);
    
    // Threshold: Rezepte page should be fast with on-demand index
    expect(duration).toBeLessThan(2500);
  });

  test("Benchmark: Smart Food Search (Speculative Prefetch)", async ({ page }) => {
    await page.goto(`${TARGET_URL}/rezepte/neu`);
    const addButton = page.locator("button:has-text('Zutat hinzufügen')");
    await addButton.waitFor({ state: "visible" });
    
    console.log("\n🚀 Benchmarking: Speculative Search Prefetch");
    
    // 1. Speculative Hover (Triggers background download)
    await addButton.hover();
    
    // Wait a small amount for the fetch to start/finish (simulating human reaction time)
    await page.waitForTimeout(300);
    
    // 2. Open Dialog
    await addButton.click();
    const searchInput = page.locator("[cmdk-input]");
    await expect(searchInput).toBeVisible();
    
    // 3. Start Search
    const start = Date.now();
    await searchInput.fill("Apfel");
    
    // Wait for a result item to appear
    await page.waitForSelector("[cmdk-item]");
    const end = Date.now();
    
    const duration = end - start;
    console.log(`⏱️  Prefetched Food Search Time: ${duration}ms`);
    
    // With prefetch, the search should be very fast (< 1000ms)
    expect(duration).toBeLessThan(1000);
  });
});
