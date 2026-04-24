import { expect, test } from "@playwright/test";

test.describe("Report Templates", () => {
  test("shows all 8 report template names in template sidebar", async ({ page }) => {
    await page.goto("/berichte");
    await expect(page.getByRole("heading", { name: "Berichte" })).toBeVisible();

    const templateCard = page
      .locator("[data-slot='card']")
      .filter({ hasText: "Textvorlagen & Platzhalter" })
      .first();
    await templateCard.scrollIntoViewIfNeeded();

    const expectedTemplates = [
      "Erstbefund Ernährungsberatung",
      "Entlassbericht Ernährungstherapie",
      "Follow-up Coaching",
      "Institution – Wochenreport",
      "Krankenkassen-Bericht",
      "Kurzbericht Standard",
      "Pädiatrischer Wachstumsbericht",
      "Verlaufsbericht Ernährungstherapie",
    ];

    for (const name of expectedTemplates) {
      await expect(templateCard.getByText(name, { exact: true })).toBeVisible();
    }
  });
});

test.describe("Mail Merge Templates", () => {
  test("shows all 6 mail merge templates in mailings section", async ({ page }) => {
    await page.goto("/patienten", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Patienten" })).toBeVisible({ timeout: 30_000 });

    const mailingsCard = page
      .locator("[data-slot='card']")
      .filter({ hasText: "Serienbriefe & Mailings" })
      .first();
    await expect(mailingsCard).toBeVisible();

    // Open the template select dropdown
    const templateSelect = mailingsCard.getByRole("combobox").first();
    await templateSelect.click();

    const expectedTemplates = [
      "Termin-Nachverfolgung",
      "Protokoll-Auswertung",
      "Geburtstagsgruß",
      "Willkommensschreiben",
      "Protokoll-Erinnerung",
      "Therapie-Abschluss",
    ];

    for (const name of expectedTemplates) {
      await expect(page.getByRole("option", { name })).toBeVisible();
    }
  });
});
