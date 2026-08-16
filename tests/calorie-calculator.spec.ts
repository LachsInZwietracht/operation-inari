import { expect, test } from "@playwright/test"

test.describe("Kalorienrechner", () => {
  test("uses a readable gauge scale for high energy requirements", async ({ page }) => {
    await page.goto("/kalorienrechner", { waitUntil: "domcontentloaded", timeout: 30_000 })
    await expect(page.getByRole("heading", { name: "Kalorienrechner" })).toBeVisible({ timeout: 30_000 })

    const numberInputs = page.locator('input[type="number"]')
    await numberInputs.nth(0).fill("14")
    await numberInputs.nth(1).fill("200")
    await numberInputs.nth(2).fill("220")

    await expect(page.getByText("Skala: 0–5.000 kcal")).toBeVisible()
    await expect(page.getByText("Gesamtbedarf", { exact: true })).toBeVisible()
  })
})
