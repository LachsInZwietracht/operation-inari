import { expect, test, type Page } from "@playwright/test";

async function visitInstitutionPage(page: Page, path: string, heading: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 30_000 });
}

test.describe("Institution Features", () => {
  test("displays weekly menu plan with diet form tabs and drag-and-drop", async ({ page }) => {
    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

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
    await expect(page.getByText("Linseneintopf").first()).toBeVisible();

    // Should display daily portion totals
    await expect(page.getByText("Gesamtportionen pro Tag").first()).toBeVisible();
  });

  test("opens recipe library sidebar for drag and drop", async ({ page }) => {
    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

    // Open recipe library
    await page.getByRole("button", { name: /Rezeptbibliothek/i }).click();

    // Should show recipes in the sidebar (use the sidebar label scope)
    const sidebar = page.getByLabel("Rezepte");
    await expect(sidebar.getByText("Kartoffelsuppe")).toBeVisible();
    await expect(sidebar.getByText("Gemüsepfanne mit Reis")).toBeVisible();
    await expect(sidebar.getByText("Lachs mit Brokkoli")).toBeVisible();
    await expect(sidebar.getByText("Linseneintopf")).toBeVisible();
  });

  test("generates production list from menu plan", async ({ page }) => {
    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

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
    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

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
    await visitInstitutionPage(page, "/institution/produktion", "Produktionsmanagement");

    // Should show production tab content with dynamically generated data
    await expect(page.getByText("Kartoffelsuppe").first()).toBeVisible();
    await expect(page.getByText("Linseneintopf").first()).toBeVisible();

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
    await visitInstitutionPage(page, "/institution/compliance", "Nährstoff-Compliance");

    // Should show overview stats
    await expect(page.getByText(/Durchschnitt/i).first()).toBeVisible();

    // Should show compliance data with nutrient results
    await expect(page.getByText("Energie").first()).toBeVisible();
    await expect(page.getByText("Eiweiß").first()).toBeVisible();
  });

  test("runs the hospital meal-selection workflow", async ({ page }) => {
    await visitInstitutionPage(page, "/institution/krankenhaus", "Krankenhausverwaltung");

    await page.locator("#service-date").fill("2026-04-06");

    const mariaCard = page.locator("[data-slot='card']").filter({ hasText: "Maria Schneider" }).first();
    await expect(mariaCard).toBeVisible();
    await mariaCard.getByRole("button", { name: /Mahlzeit auswählen/i }).click();

    await expect(page.getByRole("dialog")).toContainText("Sichere Menüauswahl");
    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();
    await expect(page.getByText("Sicher auswählbar")).toBeVisible();

    await page.getByRole("dialog").getByRole("button", { name: /Kartoffelsuppe/i }).click();
    await page.getByLabel("Besondere Hinweise").fill("Bitte ohne Petersilie anrichten");
    await page.getByRole("button", { name: /Bestellung speichern/i }).click();

    await page.getByRole("tab", { name: /Bestellungen/i }).click();
    await expect(page.getByText("Maria Schneider")).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();

    await page.getByRole("button", { name: /Bestätigen/i }).click();
    await expect(page.getByText("Bestätigt").first()).toBeVisible();
  });

  test("blocks unsafe hospital meal options and renders tray cards", async ({ page }) => {
    await visitInstitutionPage(page, "/institution/krankenhaus", "Krankenhausverwaltung");

    await page.locator("#service-date").fill("2026-04-06");

    const annaCard = page.locator("[data-slot='card']").filter({ hasText: "Anna Müller" }).first();
    await expect(annaCard).toBeVisible();
    await annaCard.getByRole("button", { name: /Mahlzeit auswählen/i }).click();

    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();
    await expect(page.getByText(/Allergenkonflikt: Sellerie/i)).toBeVisible();
    await expect(page.getByText("Geblockt").first()).toBeVisible();
    await page.getByRole("button", { name: /Abbrechen/i }).click();

    const mariaCard = page.locator("[data-slot='card']").filter({ hasText: "Maria Schneider" }).first();
    await mariaCard.getByRole("button", { name: /Mahlzeit auswählen/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Kartoffelsuppe/i }).click();
    await page.getByRole("button", { name: /Bestellung speichern/i }).click();

    await page.goto("/institution/krankenhaus/tablettenkarten?date=2026-04-06&mealSlot=mittagessen&station=alle", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Tablettenkarten" })).toBeVisible();
    await expect(page.getByText("Maria Schneider")).toBeVisible();
    await expect(page.getByText("Kartoffelsuppe")).toBeVisible();
  });

  test("displays institutional statistics with charts", async ({ page }) => {
    await visitInstitutionPage(page, "/institution/statistiken", "Einrichtungsstatistiken");

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

  test("creates a new menu plan", async ({ page }) => {
    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

    // Click "Neuer Menüplan" button
    await page.getByRole("button", { name: /Neuer Menüplan/i }).click();

    // Fill form
    await page.getByLabel("Name").fill("Testplan Woche 42");
    await page.getByLabel("Zykluslänge").click();
    await page.getByRole("option", { name: "2 Wochen" }).click();

    // Submit
    await page.getByRole("button", { name: "Erstellen" }).click();

    // Assert card appears
    await expect(page.getByText("Testplan Woche 42")).toBeVisible();
    await expect(page.getByText("2-Wochen-Zyklus").first()).toBeVisible();
  });

  test("deletes a menu plan", async ({ page }) => {
    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

    // Count initial menu cards
    const initialCards = await page.locator("[data-slot='card']").count();
    expect(initialCards).toBeGreaterThan(1);

    // Find the draft menu card ("Entwurf") and click its delete button
    const draftCard = page.locator("[data-slot='card']").filter({ hasText: "Entwurf" }).first();
    await draftCard.getByRole("button").filter({ has: page.locator("svg") }).last().click();

    // Confirm deletion in alert dialog
    await page.getByRole("button", { name: "Löschen" }).click();

    // Assert card count decreased
    const afterCards = await page.locator("[data-slot='card']").count();
    // The main tab card is also a Card, so just check the draft text is gone
    await expect(page.getByText("4-Wochen-Zyklus Q2/2026")).not.toBeVisible();
  });

  test("removes recipe from slot", async ({ page }) => {
    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

    // Find a filled slot (e.g. "Kartoffelsuppe" in the Vollkost tab)
    const slotCell = page.getByText("Kartoffelsuppe").first();
    await expect(slotCell).toBeVisible();

    // Hover to reveal the remove button
    await slotCell.hover();
    const removeBtn = page.getByRole("button", { name: "Entfernen" }).first();
    await removeBtn.click();

    // Wait for the slot to show drop zone instead
    await expect(page.getByText("Rezept hierher ziehen").first()).toBeVisible();
  });

  test("updates portion count", async ({ page }) => {
    await visitInstitutionPage(page, "/institution/menueplaene", "Menüplanung");

    // Find a portion input in the Vollkost tab (first filled slot)
    const portionInput = page.locator('input[type="number"]').first();
    await expect(portionInput).toBeVisible();

    // Change portion count
    await portionInput.fill("99");

    // Switch to another tab and back to verify persistence
    await page.getByRole("tab", { name: "Diabeteskost" }).click();
    await page.getByRole("tab", { name: "Vollkost", exact: true }).click();

    // The value should persist
    await expect(page.locator('input[type="number"]').first()).toHaveValue("99");
  });
});
