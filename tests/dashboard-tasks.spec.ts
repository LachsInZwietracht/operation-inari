import { expect, test } from "@playwright/test"

test.describe("Dashboard Aufgabenboard", () => {
  test("legt eine Aufgabe an, verschiebt sie und löscht sie wieder", async ({ page }) => {
    const title = `Testaufgabe ${Date.now()}`

    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30_000 })
    await expect(page.getByRole("heading", { name: "Aufgaben" })).toBeVisible({ timeout: 30_000 })

    const todo = page.getByRole("region", { name: "Zu erledigen" })
    const done = page.getByRole("region", { name: "Erledigt" })

    await todo.getByRole("button", { name: "Aufgabe in Zu erledigen hinzufügen" }).click()
    await todo.getByRole("textbox", { name: "Neue Aufgabe in Zu erledigen" }).fill(title)

    const created = page.waitForResponse(
      (response) => response.url().includes("/rest/v1/practice_tasks") && response.request().method() === "POST",
    )
    await todo.getByRole("textbox", { name: "Neue Aufgabe in Zu erledigen" }).press("Enter")
    await created

    await expect(todo.getByText(title)).toBeVisible()

    // Erledigt-Haken: die Karte wechselt in die dritte Spalte.
    const patched = page.waitForResponse(
      (response) => response.url().includes("/rest/v1/practice_tasks") && response.request().method() === "PATCH",
    )
    await todo.getByRole("button", { name: `"${title}" als erledigt markieren` }).click()
    await patched
    await expect(done.getByText(title)).toBeVisible()
    await expect(todo.getByText(title)).toHaveCount(0)

    // Nach einem Reload muss sie dort geblieben sein — sonst wurde nichts gespeichert.
    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(done.getByText(title)).toBeVisible({ timeout: 30_000 })

    await done.getByRole("button", { name: `Aktionen für "${title}"` }).click()
    await page.getByRole("menuitem", { name: "Löschen" }).click()
    await expect(page.getByText(title)).toHaveCount(0)
  })
})
