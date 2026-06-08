import { expect, test } from "@playwright/test";

test.describe("Navigation", () => {
  test("redirects root to dashboard", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveTitle(/Prodi/);
  });

  test("sidebar navigates to all main routes", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    const sidebar = page.locator("[data-slot='sidebar-container']");
    await expect(sidebar).toBeVisible({ timeout: 30_000 });

    const navTimeout = 120_000;
    const steps: {
      label: string;
      path: string;
      url: RegExp;
      heading: string;
      exact?: boolean;
    }[] = [
      { label: "Lebensmittel", path: "/lebensmittel/uebersicht", url: /\/lebensmittel\/uebersicht/, heading: "Lebensmittel" },
      { label: "Rezepte", path: "/rezepte", url: /\/rezepte/, heading: "Rezepte" },
      {
        label: "Ernährungspläne",
        path: "/ernaehrungsplaene",
        url: /\/ernaehrungsplaene/,
        heading: "Ernährungspläne",
      },
      {
        label: "Austauschtabellen",
        path: "/austauschtabellen",
        url: /\/austauschtabellen/,
        heading: "Austauschtabellen",
      },
      { label: "Patienten", path: "/patienten", url: /\/patienten/, heading: "Patienten" },
      { label: "Berichte", path: "/berichte", url: /\/berichte/, heading: "Berichte" },
      {
        label: "Menüpläne",
        path: "/institution/menueplaene",
        url: /\/institution\/menueplaene/,
        heading: "Menüplanung",
      },
      {
        label: "Produktion",
        path: "/institution/produktion",
        url: /\/institution\/produktion/,
        heading: "Produktionsmanagement",
      },
      {
        label: "Compliance",
        path: "/institution/compliance",
        url: /\/institution\/compliance/,
        heading: "Nährstoff-Compliance",
      },
      {
        label: "Krankenhaus",
        path: "/institution/krankenhaus",
        url: /\/institution\/krankenhaus/,
        heading: "Krankenhausverwaltung",
      },
      {
        label: "Statistiken",
        path: "/institution/statistiken",
        url: /\/institution\/statistiken/,
        heading: "Einrichtungsstatistiken",
        exact: true,
      },
    ];

    for (const step of steps) {
      await page.goto(step.path, { waitUntil: "domcontentloaded", timeout: navTimeout });
      const headingLocator = page
        .locator("main")
        .getByRole("heading", { name: step.heading, exact: step.exact ?? false });
      await expect(headingLocator).toBeVisible({ timeout: navTimeout });
      await expect(page).toHaveURL(step.url, { timeout: navTimeout });
      await expect(sidebar).toBeVisible({ timeout: navTimeout });

      // The sidebar link for the current route is present (secondary sections
      // auto-reveal when their route is active).
      const link = sidebar.getByRole("link", { name: step.label, exact: step.exact ?? false });
      await expect(link).toBeVisible({ timeout: 30_000 });
      const href = await link.getAttribute("href");
      expect(href).toBe(step.path);
    }

    const dashboardLink = sidebar.getByRole("link", { name: "Dashboard" });
    await expect(dashboardLink).toBeVisible({ timeout: navTimeout });
    await dashboardLink.click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: navTimeout });
  });
});
