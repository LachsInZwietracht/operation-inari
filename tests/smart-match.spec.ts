import { expect, test, type Page } from "@playwright/test";
import { PATIENTS } from "@/lib/mock-data";

const PROTOCOL_PATIENT = PATIENTS.find((patient) => patient.id === "patient_1")!;

async function navigateToNewProtocol(page: Page) {
  await page.goto(`/patienten/${PROTOCOL_PATIENT.id}/protokolle/neu`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "Neues Ernährungsprotokoll" }),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe("Smart-Eingabe", () => {
  test("adds food via simple smart input with high confidence", async ({ page }) => {
    await navigateToNewProtocol(page);

    // Fill in required fields
    await page.getByLabel("Titel").fill("Smart-Eingabe Test");
    await page.getByLabel("Datum").fill("2026-04-20");

    // Use Smart-Eingabe with a clear input
    const smartInput = page.getByPlaceholder("z.B. 2 Scheiben Vollkornbrot");
    await expect(smartInput).toBeVisible();
    await smartInput.fill("1 Glas Apfelsaft");
    await smartInput.press("Enter");

    // Should auto-add with high confidence — toast should appear
    await expect(page.getByText(/Hinzugefügt/)).toBeVisible({ timeout: 10_000 });

    // The entry should appear in the form
    await expect(page.getByText(/Apfelsaft/i).first()).toBeVisible();
  });

  test("shows candidate popover for compound input", async ({ page }) => {
    await navigateToNewProtocol(page);

    await page.getByLabel("Titel").fill("Compound Test");
    await page.getByLabel("Datum").fill("2026-04-20");

    const smartInput = page.getByPlaceholder("z.B. 2 Scheiben Vollkornbrot");
    await smartInput.fill("Brot mit Butter");
    await smartInput.press("Enter");

    // Should open candidate popover with multiple fragments
    await expect(page.getByText(/"Brot"/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/"Butter"/)).toBeVisible({ timeout: 10_000 });

    // Should show confidence badges
    await expect(page.getByText(/%/).first()).toBeVisible();

    // Accept the selections
    const acceptButton = page.getByRole("button", { name: /Übernehmen/ });
    await expect(acceptButton).toBeVisible();
    await acceptButton.click();

    // Should show toast
    await expect(page.getByText(/Lebensmittel hinzugefügt/)).toBeVisible({ timeout: 10_000 });
  });

  test("handles fuzzy matching with typo", async ({ page }) => {
    await navigateToNewProtocol(page);

    await page.getByLabel("Titel").fill("Fuzzy Test");
    await page.getByLabel("Datum").fill("2026-04-20");

    const smartInput = page.getByPlaceholder("z.B. 2 Scheiben Vollkornbrot");
    // Intentional typo: "Apflesaft" instead of "Apfelsaft"
    await smartInput.fill("1 Glas Apflesaft");
    await smartInput.press("Enter");

    // With fuzzy matching, should still find a match — either auto-add or show popover
    // Wait for either a toast or the popover
    const toastOrPopover = page.getByText(/Hinzugefügt|Apfel|%/);
    await expect(toastOrPopover.first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows manual search option when no match found", async ({ page }) => {
    await navigateToNewProtocol(page);

    await page.getByLabel("Titel").fill("No Match Test");
    await page.getByLabel("Datum").fill("2026-04-20");

    const smartInput = page.getByPlaceholder("z.B. 2 Scheiben Vollkornbrot");
    // Complete nonsense that should not match
    await smartInput.fill("zzzzxyzzy123");
    await smartInput.press("Enter");

    // Should show error toast
    await expect(page.getByText(/nicht erkannt/)).toBeVisible({ timeout: 10_000 });
  });
});
