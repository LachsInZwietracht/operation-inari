import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "test@prodi.local";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getTestUserId() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  const user = data.users.find((entry) => entry.email === TEST_EMAIL);
  if (!user) throw new Error("Test user not found");
  return user.id;
}

async function createPatientFixture() {
  const userId = await getTestUserId();
  const suffix = Math.random().toString(36).slice(2, 8);
  const { data, error } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      first_name: "Allergen",
      last_name: `TestPat ${suffix}`,
      date_of_birth: "1990-05-15",
      gender: "w",
    })
    .select("id, first_name, last_name")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function deletePatientFixture(patientId: string) {
  await admin.from("patient_allergens").delete().eq("patient_id", patientId);
  await admin.from("patients").delete().eq("id", patientId);
}

async function openPatientDetail(page: Page, patient: { id: string; first_name: string; last_name: string }) {
  await page.goto(`/patienten/${patient.id}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: `${patient.first_name} ${patient.last_name}` }),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe("Allergen Management", () => {
  test("can add and delete allergen entries in the Diagnosen tab", async ({ page }) => {
    const patient = await createPatientFixture();

    try {
      await openPatientDetail(page, patient);

      // Navigate to Diagnosen tab
      await page.getByRole("tab", { name: /diagnosen/i }).click();

      // Verify the allergen section is visible
      await expect(page.getByText("Allergien & Intoleranzen")).toBeVisible({ timeout: 10_000 });

      // Open the allergen form
      await page.getByRole("button", { name: "Allergen erfassen" }).click();

      // Select allergen: Gluten
      await page.getByRole("combobox", { name: /allergen/i }).first().click();
      await page.getByRole("option", { name: "Gluten" }).click();

      // Select type: Allergie (default)
      // Select severity: Schwer
      await page.locator("#allergen-severity").click();
      await page.getByRole("option", { name: "Schwer" }).click();

      // Submit
      await page.getByRole("button", { name: "Speichern" }).click();

      // Verify badge appears
      const glutenBadge = page.getByText(/Gluten · Allergie · Schwer/);
      await expect(glutenBadge).toBeVisible({ timeout: 10_000 });

      // Delete the entry
      const deleteButton = glutenBadge.locator("..").getByRole("button");
      await deleteButton.click();

      // Verify badge is gone
      await expect(glutenBadge).not.toBeVisible({ timeout: 5_000 });

      // Verify empty message shows again
      await expect(
        page.getByText("Noch keine Allergene oder Intoleranzen hinterlegt."),
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await deletePatientFixture(patient.id);
    }
  });
});
