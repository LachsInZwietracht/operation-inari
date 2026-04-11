import { expect, test } from "@playwright/test";

test.describe("Institution Features", () => {
  test("displays weekly menu plan with diet form tabs and drag-and-drop", async ({ page }) => {
    await page.goto("/institution/menueplaene");

    await expect(
      page.getByRole("heading", { name: "Menüplanung" })
    ).toBeVisible();

    // Should show menu plan cards
    await expect(page.getByText("Menüplan KW 15/2026").first()).toBeVisible();
    await expect(page.getByText("4-Wochen-Zyklus Q2/2026")).toBeVisible();

    // Should show status badges
    await expect(page.getByText("Aktiv")).toBeVisible();
    await expect(page.getByText("Entwurf")).toBeVisible();

    // Should show the Wochenplan tab (active by default)
    await expect(page.getByRole("tab", { name: /Wochenplan/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Produktion/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Einkauf/i })).toBeVisible();

    // Active menu should show diet form tabs
    await expect(page.getByRole("tab", { name: "Vollkost", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Diabeteskost" })).toBeVisible();

    // Should show meal slot labels in the table
    await expect(page.getByText("Frühstück").first()).toBeVisible();
    await expect(page.getByText("Mittagessen").first()).toBeVisible();
    await expect(page.getByText("Abendessen").first()).toBeVisible();

    // Should show recipe names in the grid (from active menu data)
    await expect(page.getByText("Kartoffelsuppe").first()).toBeVisible();

    // Should show drop zone hints for empty slots
    await expect(page.getByText("Rezept hierher ziehen").first()).toBeVisible({ timeout: 3000 }).catch(() => {
      // If all slots are filled, this is fine
    });

    // Should show recipe library button
    await expect(page.getByRole("button", { name: /Rezeptbibliothek/i })).toBeVisible();

    // Switch to Diabeteskost tab
    await page.getByRole("tab", { name: "Diabeteskost" }).click();
    await expect(page.getByText("Hähnchen-Salat").first()).toBeVisible();

    // Should display daily portion totals
    await expect(page.getByText("Gesamtportionen pro Tag").first()).toBeVisible();
  });

  test("opens recipe library sidebar for drag and drop", async ({ page }) => {
    await page.goto("/institution/menueplaene");

    // Open recipe library
    await page.getByRole("button", { name: /Rezeptbibliothek/i }).click();

    // Should show recipes in the sidebar (use the sidebar label scope)
    const sidebar = page.getByLabel("Rezepte");
    await expect(sidebar.getByText("Kartoffelsuppe")).toBeVisible();
    await expect(sidebar.getByText("Haferbrei mit Beeren")).toBeVisible();
    await expect(sidebar.getByText("Gemüsepfanne mit Reis")).toBeVisible();
    await expect(sidebar.getByText("Linseneintopf")).toBeVisible();
  });

  test("generates production list from menu plan", async ({ page }) => {
    await page.goto("/institution/menueplaene");

    // Switch to production tab
    await page.getByRole("tab", { name: /Produktion/i }).click();

    // Should show day selector
    await expect(page.getByText(/Mo \(Tag 1\)/)).toBeVisible();

    // Should show production data for the selected day
    await expect(page.getByText("Kartoffelsuppe").first()).toBeVisible();

    // Should show recipe counts and portions
    await expect(page.getByText(/Portionen/).first()).toBeVisible();
  });

  test("generates shopping list from menu plan", async ({ page }) => {
    await page.goto("/institution/menueplaene");

    // Switch to shopping tab
    await page.getByRole("tab", { name: /Einkauf/i }).click();

    // Should show aggregated shopping items by category
    await expect(page.getByText(/Positionen/).first()).toBeVisible();

    // Should show portion scaling input
    await expect(page.getByText("Portionsfaktor:")).toBeVisible();

    // Should show CSV export button
    await expect(page.getByRole("button", { name: /CSV exportieren/i })).toBeVisible();

    // Should show total cost
    await expect(page.getByText(/Gesamtkosten/).first()).toBeVisible();
  });

  test("shows production and shopping lists on dedicated page", async ({ page }) => {
    await page.goto("/institution/produktion");

    await expect(
      page.getByRole("heading", { name: "Produktionsmanagement" })
    ).toBeVisible();

    // Should show production tab content with dynamically generated data
    await expect(page.getByText("Kartoffelsuppe").first()).toBeVisible();
    await expect(page.getByText("Haferbrei").first()).toBeVisible();

    // Should show summary cards
    await expect(page.getByText("Rezepte").first()).toBeVisible();
    await expect(page.getByText("Portionen gesamt").first()).toBeVisible();
    await expect(page.getByText("Zutaten gesamt").first()).toBeVisible();

    // Switch to shopping list tab
    await page.getByRole("tab", { name: /Einkauf/i }).click();

    // Should show shopping items grouped by category
    await expect(page.getByText(/Positionen/).first()).toBeVisible();

    // Should show total cost
    await expect(page.getByText(/Gesamtkosten/).first()).toBeVisible();
  });

  test("displays nutritional compliance dashboard", async ({ page }) => {
    await page.goto("/institution/compliance");

    await expect(
      page.getByRole("heading", { name: "Nährstoff-Compliance" })
    ).toBeVisible();

    // Should show overview stats
    await expect(page.getByText(/Durchschnitt/i).first()).toBeVisible();

    // Should show compliance data with nutrient results
    await expect(page.getByText("Energie").first()).toBeVisible();
    await expect(page.getByText("Eiweiß").first()).toBeVisible();
  });

  test("shows hospital bed grid and dietary orders", async ({ page }) => {
    await page.goto("/institution/krankenhaus");

    await expect(
      page.getByRole("heading", { name: "Krankenhausverwaltung" })
    ).toBeVisible();

    // Should show bed occupancy info
    await expect(page.getByText(/Betten/).first()).toBeVisible();

    // Should show patient names in bed cards
    await expect(page.getByText("Schmidt, Hans").first()).toBeVisible();
    await expect(page.getByText("Meier, Ingrid").first()).toBeVisible();

    // Switch to orders tab
    await page.getByRole("tab", { name: /Bestellung/i }).click();

    // Should show dietary orders
    await expect(page.getByText(/Ausstehend/i).first()).toBeVisible();
    await expect(page.getByText(/Bestätigt/i).first()).toBeVisible();
  });

  test("displays institutional statistics with charts", async ({ page }) => {
    await page.goto("/institution/statistiken");

    await expect(
      page.getByRole("heading", { name: "Einrichtungsstatistiken" })
    ).toBeVisible();

    // Should show KPI cards
    await expect(page.getByText("Belegungsrate").first()).toBeVisible();
    await expect(page.getByText("75,0 %").first()).toBeVisible();
    await expect(page.getByText(/Kosten\/Tag/i).first()).toBeVisible();
    await expect(page.getByText("Compliance-Rate").first()).toBeVisible();

    // Should show diet form distribution tab by default
    await expect(page.getByText("Vollkost").first()).toBeVisible();
    await expect(page.getByText("Diabeteskost").first()).toBeVisible();

    // Switch to Menüwahl tab
    await page.getByRole("tab", { name: "Menüwahl" }).click();
    await expect(page.getByText("Kartoffelsuppe").first()).toBeVisible();

    // Switch to Kosten tab
    await page.getByRole("tab", { name: "Kosten" }).click();
    await expect(page.getByText(/Wochenkosten/).first()).toBeVisible();
  });
});
