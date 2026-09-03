import { expect, test } from "@playwright/test";

test.describe("Navigation", () => {
  test("redirects root to dashboard", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveTitle(/Inari/);
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
        path: "/ernaehrungsplan/bibliothek",
        url: /\/ernaehrungsplan\/bibliothek/,
        heading: "Planvorlagen",
      },
      // /austauschtabellen is intentionally not a sidebar destination. It is a
      // contextual tool of the plan workflow, reached from the Ernährungspläne
      // tool list and from the plan exchange card, so it has no entry in
      // lib/navigation.ts and does not belong in this sidebar sweep.
      // The patient chain is split at the seam where a plan starts: Aufnahmen
      // holds everyone still being taken on, Patienten everyone under care.
      {
        label: "Aufnahmen",
        path: "/patienten/aufnahmen",
        url: /\/patienten\/aufnahmen/,
        heading: "Aufnahmen",
      },
      { label: "Patienten", path: "/patienten", url: /\/patienten$/, heading: "Patienten" },
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

  /**
   * The header trail is the only thing on screen that says where a page sits.
   * It is derived from the URL, so a route that gains a segment has to keep
   * naming it — a silent empty trail is the failure mode worth catching.
   */
  test("header trail names the current route and links its parent", async ({ page }) => {
    await page.goto("/patienten/aufnahmen", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    // Scoped to the header: list pages render a breadcrumb of their own.
    const trail = page.locator("header nav[aria-label='breadcrumb']");
    await expect(trail).toBeVisible({ timeout: 30_000 });
    await expect(trail).toContainText("Aufnahmen");

    const parent = trail.getByRole("link", { name: "Patienten" });
    await expect(parent).toHaveAttribute("href", "/patienten");
    await parent.click();
    await expect(page).toHaveURL(/\/patienten$/, { timeout: 30_000 });
    await expect(trail).toContainText("Patienten");
  });

  test("global command palette opens with Cmd+K and navigates", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("ControlOrMeta+k");

    const paletteInput = page.getByPlaceholder(/Wohin möchtest du springen/);
    await expect(paletteInput).toBeVisible({ timeout: 15_000 });

    await paletteInput.fill("Rezepte");
    const recipesOption = page.getByRole("option", { name: /Rezepte/ }).first();
    await expect(recipesOption).toBeVisible();
    await recipesOption.click();

    await expect(page).toHaveURL(/\/rezepte/, { timeout: 30_000 });
  });
});
