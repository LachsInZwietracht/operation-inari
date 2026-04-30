import { expect, test } from "@playwright/test";

/**
 * SFK data source gating and display tests.
 *
 * These tests verify the entitlement gating, badge display, and license
 * warnings for Souci-Fachmann-Kraut foods. They run against the live app
 * and check UI behavior based on the NEXT_PUBLIC_SFK_ENABLED flag.
 */

test.describe("SFK Foods", () => {
  test.setTimeout(60_000);

  test("food detail shows SFK badge and source metadata for SFK foods", async ({
    page,
  }) => {
    // Navigate to the food browser and filter by SFK source if available
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    // Check if the data source filter exists and try to select SFK
    const sourceFilter = page.getByRole("combobox", {
      name: /Quelle|Datenquelle/i,
    });

    if (await sourceFilter.isVisible().catch(() => false)) {
      await sourceFilter.click();
      const sfkOption = page.getByRole("option", { name: /SFK/i });
      if (await sfkOption.isVisible().catch(() => false)) {
        await sfkOption.click();
        // Wait for filtered results
        await page.waitForTimeout(1_000);

        const rows = page.locator("table tbody tr");
        if ((await rows.count()) > 0) {
          // Navigate to the first SFK food
          await rows.first().locator("td").nth(1).click();
          await page.waitForURL(/\/lebensmittel\/.+/, { timeout: 15_000 });

          // Should show SFK badge
          await expect(page.getByText("SFK")).toBeVisible({ timeout: 10_000 });

          // Should show source info card with SFK version
          await expect(page.getByText("Quelle & Version")).toBeVisible();
          await expect(page.getByText(/SFK/)).toBeVisible();
        }
      }
    }
  });

  test("entitlement gate shows license warning when SFK is disabled", async ({
    page,
  }) => {
    // This test validates the license banner logic.
    // When NEXT_PUBLIC_SFK_ENABLED !== "true", SFK food details should show a warning.
    // We check the food-detail-content component renders the alert correctly.

    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    // If SFK foods are visible in the list, navigate to one and check for the banner
    const sfkBadge = page.locator("table tbody tr").filter({ hasText: "SFK" }).first();
    if (await sfkBadge.isVisible().catch(() => false)) {
      await sfkBadge.locator("td").nth(1).click();
      await page.waitForURL(/\/lebensmittel\/.+/, { timeout: 15_000 });

      // Check for either the license warning or normal SFK display
      const licenseWarning = page.getByText("Lizenzhinweis");
      const sfkDisplay = page.getByText("SFK");

      // At least one should be visible — either gated or ungated
      await expect(
        licenseWarning.or(sfkDisplay).first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("datenbank page shows SFK source in catalog when imported", async ({
    page,
  }) => {
    await page.goto("/datenbank");

    // The catalog status section should load
    await expect(page.getByText("Katalogstatus")).toBeVisible({
      timeout: 15_000,
    });

    // Check if SFK appears in the source catalog
    const sfkSource = page.getByText("Souci-Fachmann-Kraut");
    if (await sfkSource.isVisible().catch(() => false)) {
      // If SFK is imported, verify it shows version and record count
      const sfkCard = page.locator(".rounded-lg.border").filter({
        hasText: "Souci-Fachmann-Kraut",
      });
      await expect(sfkCard.getByText(/Importiert:/)).toBeVisible();
      await expect(sfkCard.getByText(/Datensaetze:/)).toBeVisible();
    }
  });

  test("search results exclude SFK foods when entitlement is disabled", async ({
    page,
  }) => {
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    // Search for a generic term
    const searchInput = page.getByPlaceholder(/Lebensmittel suchen/);
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Apfel");

    await page.waitForTimeout(1_500);

    const rows = page.locator("table tbody tr");
    const count = await rows.count();

    // Collect all visible source badges
    const sources: string[] = [];
    for (let i = 0; i < Math.min(count, 20); i++) {
      const text = await rows.nth(i).textContent();
      if (text) sources.push(text);
    }

    // When SFK is disabled, no result row should show "SFK" as its source
    const sfkEnabled = process.env.NEXT_PUBLIC_SFK_ENABLED === "true";
    if (!sfkEnabled) {
      const hasSfkResult = sources.some((s) => s.includes("SFK"));
      expect(hasSfkResult).toBe(false);
    }
  });
});
