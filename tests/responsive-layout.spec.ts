import { expect, test } from "@playwright/test";

const RESPONSIVE_ROUTES = [
  "/dashboard",
  "/lebensmittel",
  "/patienten",
  "/institution/menueplaene",
  "/institution/krankenhaus",
  "/institution/produktion",
  "/api-export",
];

const VIEWPORTS = [
  { label: "mobile", width: 390, height: 844 },
  { label: "tablet", width: 768, height: 1024 },
  { label: "desktop", width: 1280, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`Responsive layout: ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of RESPONSIVE_ROUTES) {
      test(`${route} does not create document-level horizontal overflow`, async ({ page }) => {
        await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

        const width = await page.evaluate(() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }));

        expect(width.document, JSON.stringify(width)).toBeLessThanOrEqual(width.viewport + 2);
        expect(width.body, JSON.stringify(width)).toBeLessThanOrEqual(width.viewport + 2);
      });
    }
  });
}
