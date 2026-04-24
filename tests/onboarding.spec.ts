import { expect, test } from "@playwright/test";

const ONBOARDING_KEYS = [
  "prodi_onboarding_status",
  "prodi_practice_info",
  "prodi_patients",
  "prodi_practice_appointments",
  "prodi_practice_invoices",
  "prodi_counseling_sessions",
  "prodi_report_templates",
];

async function clearOnboardingState(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  await page.evaluate((keys) => {
    for (const key of keys) localStorage.removeItem(key);
  }, ONBOARDING_KEYS);
}

test.describe("Onboarding Wizard", () => {
  test("fresh user sees onboarding dialog", async ({ page }) => {
    await clearOnboardingState(page);
    await page.goto("/dashboard");

    const wizard = page.getByTestId("onboarding-wizard");
    await expect(wizard).toBeVisible();
    await expect(wizard.getByText("Willkommen bei Inari")).toBeVisible();
  });

  test("can fill practice info and advance to step 2", async ({ page }) => {
    await clearOnboardingState(page);
    await page.goto("/dashboard");

    const wizard = page.getByTestId("onboarding-wizard");
    await expect(wizard.getByText("Willkommen bei Inari")).toBeVisible();

    await wizard.getByLabel("Praxisname *").fill("Testpraxis");
    await wizard.getByLabel("Adresse").fill("Musterstraße 1, 12345 Berlin");
    await wizard.getByLabel("Telefon").fill("+49 30 123456");

    await wizard.getByRole("button", { name: "Weiter" }).click();

    await expect(wizard.getByText("Erste:n Patient:in anlegen")).toBeVisible();
  });

  test("can skip patient creation step", async ({ page }) => {
    await clearOnboardingState(page);
    await page.goto("/dashboard");

    const wizard = page.getByTestId("onboarding-wizard");

    // Fill practice info first
    await wizard.getByLabel("Praxisname *").fill("Testpraxis");
    await wizard.getByRole("button", { name: "Weiter" }).click();
    await expect(wizard.getByText("Erste:n Patient:in anlegen")).toBeVisible();

    // Skip patient step
    await wizard.getByRole("button", { name: "Überspringen" }).click();

    await expect(wizard.getByText("Schnelltipps")).toBeVisible();
  });

  test("can complete all 3 steps and dialog disappears", async ({ page }) => {
    await clearOnboardingState(page);
    await page.goto("/dashboard");

    const wizard = page.getByTestId("onboarding-wizard");

    // Step 0: Practice info
    await wizard.getByLabel("Praxisname *").fill("Praxis Müller");
    await wizard.getByRole("button", { name: "Weiter" }).click();

    // Step 1: Skip patient
    await wizard.getByRole("button", { name: "Überspringen" }).click();

    // Step 2: Complete
    await wizard.getByRole("button", { name: "Fertig" }).click();

    await expect(page.getByTestId("onboarding-wizard")).toBeHidden();
  });

  test("onboarding does not reappear after completion", async ({ page }) => {
    await clearOnboardingState(page);
    await page.goto("/dashboard");

    const wizard = page.getByTestId("onboarding-wizard");
    await wizard.getByLabel("Praxisname *").fill("Praxis Test");
    await wizard.getByRole("button", { name: "Weiter" }).click();
    await wizard.getByRole("button", { name: "Überspringen" }).click();
    await wizard.getByRole("button", { name: "Fertig" }).click();
    await expect(page.getByTestId("onboarding-wizard")).toBeHidden();

    // Reload page
    await page.reload();

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByTestId("onboarding-wizard")).toHaveCount(0);
  });

  test("onboarding can be dismissed via dialog close", async ({ page }) => {
    await clearOnboardingState(page);
    await page.goto("/dashboard");

    const wizard = page.getByTestId("onboarding-wizard");
    await expect(wizard.getByText("Willkommen bei Inari")).toBeVisible();

    // Close via the X button on the dialog
    await page.locator("[data-testid='onboarding-wizard'] button[data-slot='dialog-close']").click();

    await expect(page.getByTestId("onboarding-wizard")).toBeHidden();

    // Reload — should not reappear because skipOnboarding was called
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByTestId("onboarding-wizard")).toHaveCount(0);
  });
});
