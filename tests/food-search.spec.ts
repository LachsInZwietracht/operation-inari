import { expect, test, type Page } from "@playwright/test";
import { admin } from "./fixtures/clinic-demo";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function waitForFoodSearchInput(page: Page) {
  const input = page.getByPlaceholder(/Lebensmittel suchen/);
  await expect(input).toBeVisible({ timeout: 30_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  return input;
}

// BLS 4.0 food names differ from mock data.
// Real names: "Karotte/Möhre, roh", "Broccoli roh", "Hähnchen Brustfilet, roh"

test.describe("Lebensmittel", () => {
  // The BLS catalog has 7,140 foods — give pages time to load under multi-worker pressure
  test.setTimeout(90_000);

  test("searches and filters foods with fuzzy matching", async ({ page }) => {
    await page.goto("/lebensmittel");

    // Wait for foods to load from Supabase. The first row becoming visible is
    // not enough — the table streams in and counting right away catches it
    // mid-render, so poll until the count has actually settled above the bar.
    const initialRows = page.locator("table tbody tr");
    await expect(initialRows.first()).toBeVisible({ timeout: 30_000 });
    await expect(async () => {
      expect(await initialRows.count()).toBeGreaterThan(10);
    }).toPass({ timeout: 30_000 });
    // Exact substring search — "Karotte" should match "Karotte/Möhre, roh" etc.
    const searchInput = await waitForFoodSearchInput(page);
    await searchInput.fill("Karotte");

    // Wait for the *results*, not merely for the row count to change: while the
    // query is in flight the body renders a single full-width loading row, so a
    // count check would run against the loading state.
    //
    // Note the row count itself proves nothing here — the browser paginates at
    // 25, so the broad and the narrow list both fill a page. What filtering
    // actually changes is *which* foods are listed.
    const filteredRows = page.locator("table tbody tr");
    await expect(filteredRows.first()).toContainText(/Karotte/, { timeout: 30_000 });
    expect(await filteredRows.count()).toBeGreaterThan(0);

    // Clearing the search lifts the filter: a full page of foods again, no
    // longer scoped to the query. (Row identity is not asserted — rows pick up
    // synonym badges and hover controls once the search index loads, so their
    // text is not stable across the two reads.)
    await searchInput.fill("");
    await expect(async () => {
      const rows = page.locator("table tbody tr");
      expect(await rows.count()).toBeGreaterThan(10);
      expect(await rows.first().innerText()).not.toMatch(/Karotte/);
    }).toPass({ timeout: 30_000 });
  });

  test("fuzzy search finds foods with typos", async ({ page }) => {
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    // "Brokoli" should fuzzy-match "Broccoli roh" (BLS spells it "Broccoli")
    const typoInput = await waitForFoodSearchInput(page);
    await typoInput.fill("Brokoli");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    await expect(rows.filter({ hasText: "Broccoli" }).first()).toBeVisible();
  });

  test("fuzzy search finds foods with partial words", async ({ page }) => {
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    // "Hähnchen" should match "Hähnchen Brustfilet, roh" etc.
    const partialInput = await waitForFoodSearchInput(page);
    await partialInput.fill("Hähnchen");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    await expect(rows.filter({ hasText: /hähnchen/i }).first()).toBeVisible();
  });

  test("allows adding and removing custom synonyms", async ({ page }) => {
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    const aliasInput = await waitForFoodSearchInput(page);
    await aliasInput.fill("Karotte");
    await expect(page.locator("table tbody tr").first()).toContainText(
      /Karotte/,
      { timeout: 10_000 }
    );
    const row = page.locator("table tbody tr").first();
    await row.getByRole("button", { name: "Aliase verwalten" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("z.B. Nudeln").fill("Moehre");
    await dialog.getByRole("button", { name: "Alias hinzufügen" }).click();
    await expect(dialog.getByText("Moehre").first()).toBeVisible();

    // Close dialog via the X button
    await dialog.locator("[data-slot='dialog-close']").click();
    await expect(dialog).toBeHidden();

    await expect(row).toContainText("Moehre");

    // cleanup so other tests are unaffected
    await row.getByRole("button", { name: "Aliase verwalten" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Alias Moehre löschen" }).click();
    await dialog.locator("[data-slot='dialog-close']").click();
    await expect(dialog).toBeHidden();
  });

  test("search mode selector switches between modes", async ({ page }) => {
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    // Default mode is Name
    const nameButton = page.getByRole("button", { name: /Name/ });
    await expect(nameButton).toBeVisible();

    // Switch to Code mode
    await page.getByRole("button", { name: /^Code$/ }).click();
    await expect(
      page.getByPlaceholder(/BLS-Code eingeben/)
    ).toBeVisible({ timeout: 5_000 });

    // BLS code column should be visible in code mode
    await expect(page.locator("th", { hasText: "BLS-Code" })).toBeVisible();

    // Search by BLS code prefix "G62" (Karotte/Möhre, roh has code G620100)
    await page.getByPlaceholder(/BLS-Code eingeben/).fill("G62");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await expect(rows.first()).toContainText(/Karotte/);
  });

  test("food group navigation filters correctly", async ({ page }) => {
    await page.goto("/lebensmittel");
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 30_000,
    });

    // Switch to Group mode
    await page.getByRole("button", { name: /Gruppe/ }).click();

    // Should show the food group tree
    await expect(
      page.getByText("Lebensmittelgruppen (BLS)")
    ).toBeVisible({ timeout: 5_000 });

    // Click on the fish food group — may need scroll in the max-h-64 container
    const fishButton = page.getByRole("button", { name: "Fisch und Meeresfrüchte" });
    await fishButton.scrollIntoViewIfNeeded();
    await fishButton.click();

    // Should filter to show fish items
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });

    // Assert the filter actually scoped the list to the fish subtree rather
    // than naming species that happen to sit on page one. The catalog is
    // alphabetical, so which fish appear first is not the filter's contract —
    // "every visible row belongs to a fish group" is.
    //
    // Poll rather than read once: while the filtered page is in flight the
    // body renders a single full-width colspan row, which has no second cell.
    const fishGroupNames = /Seefisch|Süßwasserfisch|Meeresfrüchte|Fischerzeugnisse/;
    await expect(async () => {
      const labels = await page.locator("table tbody tr td:nth-child(2)").allInnerTexts();
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label).toMatch(fishGroupNames);
      }
    }).toPass({ timeout: 30_000 });
  });

  test("default listing leads with the curated reference catalog", async ({ page }) => {
    await page.goto("/lebensmittel");

    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    await expect(async () => {
      expect(await rows.count()).toBeGreaterThan(10);
    }).toPass({ timeout: 30_000 });

    // Open Food Facts outnumbers BLS ~94k to ~7k and many of its product names
    // start with punctuation, so plain alphabetical order opened the browser on
    // "_Muffins von Kathi". The catalog a dietitian is trained on has to lead;
    // OFF stays reachable through search and the source selector.
    // Branded rows are tagged with an "OFF" badge in the name cell; curated
    // BLS/SFK rows carry none. The whole first page should be curated.
    await expect(
      page.locator("table tbody tr").getByText("OFF", { exact: true }),
    ).toHaveCount(0);
  });

  test("navigates to food detail and shows nutrient tabs", async ({ page }) => {
    await page.goto("/lebensmittel");

    // Wait for data to load
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });

    // Click on a non-interactive cell (category column) to trigger row navigation
    await firstRow.locator("td").nth(1).click();

    // Wait for navigation to the detail page
    await page.waitForURL(/\/lebensmittel\/.+/, { timeout: 15_000 });

    // Check detail cards render
    await expect(page.getByText("Quelle & Version")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Produktinfos")).toBeVisible({
      timeout: 10_000,
    });

    // Switch to Vitamine tab
    await page.getByRole("tab", { name: /Vitamine/i }).click();
    await expect(page.getByText("Vitamin C")).toBeVisible();

    // Switch to Mineralstoffe tab
    await page.getByRole("tab", { name: /Mineralstoffe/i }).click();
    await expect(page.getByText("Calcium")).toBeVisible();
  });

  test("command palette search jumps to food detail", async ({ page }) => {
    await page.goto("/dashboard");

    const paletteButton = page.getByRole("button", {
      name: /Suchen oder springen/,
    });
    await expect(paletteButton).toBeVisible({ timeout: 15_000 });
    await paletteButton.click();

    const foodSearchItem = page.getByRole("option", {
      name: /Lebensmittel suchen/,
    });
    await expect(foodSearchItem).toBeVisible();
    await foodSearchItem.click();

    const searchInput = page.getByPlaceholder(/Tippfehler werden erkannt/);
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Karotte");

    // Wait for RPC search results to appear (debounce 200ms + network)
    const result = page.getByRole("option", { name: /Karotte/ }).first();
    await expect(result).toBeVisible({ timeout: 15_000 });
    await result.click();

    await expect(page).toHaveURL(/\/lebensmittel\//, { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: /Karotte/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Makronährstoffe", { exact: false })
    ).toBeVisible();
  });

  test("branded food detail resolves through the shared food data layer", async ({
    page,
  }) => {
    // This used to point at `brand_quick_oats` from lib/mock-data, which the
    // data layer only served while the database held zero branded rows. The
    // Open Food Facts import ended that, so the mock fallback is dead code for
    // this path and the id 404s. Resolve a real branded food instead — that is
    // what the test is actually about.
    const { data, error } = await admin
      .from("foods")
      .select("id,name,manufacturer")
      .eq("is_branded", true)
      .not("manufacturer", "is", null)
      .limit(1)
      .single();

    expect(error, "no branded food available to resolve").toBeNull();
    const branded = data!;

    await page.goto(`/lebensmittel/${branded.id}`);

    await expect(
      page.getByRole("heading", { name: branded.name, exact: false })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Produktinfos")).toBeVisible();
    await expect(
      page.getByText(new RegExp(escapeRegExp(branded.manufacturer!), "i")).first()
    ).toBeVisible();
  });
});
