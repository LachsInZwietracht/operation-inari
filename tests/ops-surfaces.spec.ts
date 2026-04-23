import { expect, test } from "@playwright/test";

test.describe("Ops Surfaces", () => {
  test("shows admin page as preview instead of live team management", async ({ page }) => {
    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "Admin & Sicherheit" })).toBeVisible();
    await expect(page.getByText("Kein produktives RBAC-/Teammanagement-Backend")).toBeVisible();
    await expect(page.getByText("Rollenmatrix & Berechtigungen")).toBeVisible();
  });

  test("loads live data source catalog on datenbank page", async ({ page }) => {
    await page.goto("/datenbank");

    await expect(page.getByRole("heading", { name: "Datenbankstatus" })).toBeVisible();
    await expect(page.getByText("Katalogstatus")).toBeVisible();
    await expect(page.getByText("BLS (Bundeslebensmittelschlüssel)")).toBeVisible();
  });

  test("distinguishes bundled knowledge cards from live analytics", async ({ page }) => {
    await page.goto("/wissen");

    await expect(page.getByRole("heading", { name: "Wissensbibliothek" })).toBeVisible();
    await expect(page.getByText("Bundled Defaults")).toBeVisible();
    await expect(page.getByText("Live-Analyse").first()).toBeVisible();
    await expect(page.getByText("Makronaehrstoffe kompakt")).toBeVisible();
  });
});
