import { expect, test } from "@playwright/test"

test.describe("Praxis-Dashboard Kalender", () => {
  test("shows a Monday-to-Sunday week and allows week navigation", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30_000 })
    await expect(page.getByRole("heading", { name: "Kalender" })).toBeVisible({ timeout: 30_000 })

    const calendar = page.getByRole("tablist", { name: "Kalendertage" })
    await expect(calendar.getByRole("tab")).toHaveCount(7)
    await expect(calendar.getByRole("tab", { name: /Montag/ })).toHaveCount(1)
    await expect(calendar.getByRole("tab", { name: /Samstag.*Wochenende/ })).toHaveCount(1)
    await expect(calendar.getByRole("tab", { name: /Sonntag.*Wochenende/ })).toHaveCount(1)
    await expect(page.getByRole("link", { name: "Großen Kalender öffnen" })).toHaveCount(0)

    const rangeBefore = await page.getByRole("heading", { name: "Kalender" }).locator("..").getByText(/–/).textContent()
    await page.getByRole("button", { name: "Nächste Woche" }).click()
    await expect(page.getByRole("heading", { name: "Kalender" }).locator("..").getByText(/–/)).not.toHaveText(rangeBefore ?? "")
    await page.getByRole("button", { name: "Heute" }).click()
    await expect(calendar.getByRole("tab", { selected: true })).toHaveCount(1)
  })
})
