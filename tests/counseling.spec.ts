import { expect, test, type Page } from "@playwright/test";
import { PATIENTS } from "@/lib/mock-data";

const COUNSELING_PATIENT = PATIENTS.find((patient) => patient.id === "patient_1")!;

async function openCounselingTab(page: Page) {
  await page.goto(`/patienten/${COUNSELING_PATIENT.id}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: `${COUNSELING_PATIENT.firstName} ${COUNSELING_PATIENT.lastName}` })).toBeVisible({ timeout: 30_000 });
  const counselingTab = page.getByRole("tab", { name: "Beratung" });
  await expect(counselingTab).toBeVisible({ timeout: 30_000 });
  await counselingTab.click();
}

test.describe("Counseling Sessions", () => {
  test("views existing counseling session", async ({ page }) => {
    await openCounselingTab(page);

    // Should see existing sessions
    await expect(page.getByText(/Erstberatung – Adipositas/)).toBeVisible();

    // Click on session
    const sessionLink = page.getByRole("link", { name: /Erstberatung – Adipositas/ }).first();
    await expect(sessionLink).toBeVisible();
    await sessionLink.click();

    // Should show session detail
    await expect(page.getByTestId("counseling-session-documentation-title")).toBeVisible();
    await expect(page.getByTestId("counseling-session-content")).toContainText("Anamnese");
  });

  test("creates counseling session with template", async ({ page }) => {
    await openCounselingTab(page);
    await page.getByRole("link", { name: "Neue Beratung" }).click();

    await expect(page.getByRole("heading", { name: "Neue Beratungssitzung" })).toBeVisible({ timeout: 30_000 });

    // Click template button
    await page.getByRole("button", { name: "Vorlage einfügen" }).click();

    // Select a template from the dialog
    await expect(page.getByRole("heading", { name: "Vorlage auswählen" })).toBeVisible();
    const templateCard = page.locator("[data-slot=card]").filter({ hasText: "Erstberatung Adipositas" }).first();
    await expect(templateCard).toBeVisible();
    await templateCard.click();

    // Template content should be inserted into the textarea
    const textarea = page.locator('textarea[placeholder="Beratungsdokumentation..."]');
    await expect(textarea).not.toBeEmpty();
  });
});
