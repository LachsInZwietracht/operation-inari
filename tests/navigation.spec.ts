import { expect, test } from "@playwright/test";

test.describe("Navigation", () => {
  test("redirects root to dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).toHaveTitle(/Prodi/);
  });

  test("sidebar navigates to all main routes", async ({ page }) => {
    await page.goto("/dashboard");

    const sidebar = page.locator("[data-slot='sidebar-container']");

    // Navigate to Lebensmittel
    await sidebar.getByRole("link", { name: "Lebensmittel" }).click();
    await expect(page).toHaveURL(/\/lebensmittel/);
    await expect(page.getByRole("heading", { name: "Lebensmittel", exact: true })).toBeVisible();

    // Navigate to Rezepte
    await sidebar.getByRole("link", { name: "Rezepte" }).click();
    await expect(page).toHaveURL(/\/rezepte/);
    await expect(page.getByRole("heading", { name: "Rezepte" })).toBeVisible();

    // Navigate to Ernährungsplan
    await sidebar.getByRole("link", { name: "Ernährungsplan" }).click();
    await expect(page).toHaveURL(/\/ernaehrungsplan/);
    await expect(page.getByRole("heading", { name: "Ernährungsplan" })).toBeVisible();

    // Navigate to Austauschtabellen
    await sidebar.getByRole("link", { name: "Austauschtabellen" }).click();
    await expect(page).toHaveURL(/\/austauschtabellen/);
    await expect(page.getByRole("heading", { name: "Austauschtabellen" })).toBeVisible();

    // Navigate to Patienten
    await sidebar.getByRole("link", { name: "Patienten" }).click();
    await expect(page).toHaveURL(/\/patienten/);
    await expect(page.getByRole("heading", { name: "Patienten" })).toBeVisible();

    // Navigate to Berichte
    await sidebar.getByRole("link", { name: "Berichte" }).click();
    await expect(page).toHaveURL(/\/berichte/);
    await expect(page.getByRole("heading", { name: "Berichte" })).toBeVisible();

    // Navigate back to Dashboard
    await sidebar.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
