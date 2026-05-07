import { expect, test } from "@playwright/test";

import { admin, getTestUserId } from "./fixtures/clinic-demo";

async function getTestOrganizationId(userId: string) {
  const { data, error } = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.organization_id) throw new Error("Test organization not found");
  return data.organization_id as string;
}

test.describe("Ops Surfaces", () => {
  test.describe.configure({ mode: "serial" });

  test("shows live admin team and retention controls", async ({ page }) => {
    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "Admin & Sicherheit" })).toBeVisible();
    await expect(page.getByText("Teammitglied einladen")).toBeVisible();
    await expect(page.getByText("Teammitglieder")).toBeVisible();
    await expect(page.getByRole("button", { name: "SSO-Konfiguration speichern" })).toBeVisible();
    await expect(page.getByText("Berichtsaufbewahrung")).toBeVisible();
  });

  test("shows the admin integration operations surface", async ({ page }) => {
    await page.goto("/admin/integrationen");

    await expect(page.getByRole("heading", { name: "Integrationen" })).toBeVisible();
    await expect(page.getByText("HL7 Import-Jobs")).toBeVisible();
    await expect(page.getByText("Review-Ergebnisse", { exact: true })).toBeVisible();
    await expect(page.getByText("HL7 Labormappings")).toBeVisible();
  });

  test("creates and disables an HL7 lab mapping from integration admin", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sourceSystem = `ops-lab-${suffix}`;
    const hl7Identifier = `4548-${suffix}`;

    await page.goto("/admin/integrationen");
    await page.locator("#hl7-mapping-source").fill(sourceSystem);
    await page.locator("#hl7-mapping-identifier").fill(hl7Identifier);
    await page.locator("#hl7-mapping-text").fill("HbA1c Test");
    await page.locator("#hl7-mapping-coding").fill("LN");
    await page.locator("#hl7-mapping-parameter").fill("lab_hba1c");
    await page.locator("#hl7-mapping-unit").fill("%");
    await page.getByRole("button", { name: "Mapping speichern" }).click();

    await expect(page.getByText("HL7-Labormapping wurde gespeichert.")).toBeVisible({ timeout: 15_000 });
    const mappingRow = page.getByRole("row", { name: new RegExp(`${sourceSystem} ${hl7Identifier}`) }).first();
    await expect(mappingRow).toBeVisible();

    await mappingRow.getByRole("button", { name: "Deaktivieren" }).click();
    await expect(page.getByText("HL7-Labormapping wurde deaktiviert.")).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(`${sourceSystem} ${hl7Identifier}.*Deaktiviert`) }).first()).toBeVisible();
  });

  test("filters HL7 jobs, opens details, and marks review results checked", async ({ page }) => {
    const userId = await getTestUserId();
    const organizationId = await getTestOrganizationId(userId);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sourceSystem = `ops-review-${suffix}`;
    const messageControlId = `OPS-REVIEW-${suffix}`;
    const hl7Identifier = `99999-${suffix}`;

    const { data: job, error: jobError } = await admin
      .from("hl7_import_jobs")
      .insert({
        organization_id: organizationId,
        actor_user_id: userId,
        source_system: sourceSystem,
        message_control_id: messageControlId,
        message_type: "ORU^R01",
        status: "needs_review",
        raw_message_sha256: "0".repeat(64),
        summary: {
          counts: {
            patientsCreated: 0,
            patientsUpdated: 0,
            labValuesCreated: 0,
            needsReview: 1,
            skipped: 0,
            failed: 0,
          },
          reviewItems: [{ reason: "UNKNOWN_LAB_MAPPING", hl7Identifier }],
        },
      })
      .select("id")
      .single();
    if (jobError) throw new Error(jobError.message);

    const { data: result, error: resultError } = await admin
      .from("hl7_import_results")
      .insert({
        job_id: job.id,
        target_type: "patient_lab_value",
        status: "needs_review",
        metadata: {
          reason: "UNKNOWN_LAB_MAPPING",
          hl7Identifier,
        },
      })
      .select("id")
      .single();
    if (resultError) throw new Error(resultError.message);

    try {
      await page.goto("/admin/integrationen");
      await page.getByLabel("Status").first().selectOption("needs_review");
      await page.getByLabel("Quelle").first().fill(sourceSystem);
      await page.getByRole("button", { name: "Filtern" }).click();

      const jobRow = page.getByRole("row", { name: new RegExp(`${sourceSystem} ORU\\^R01 ${messageControlId}`) }).first();
      await expect(jobRow).toBeVisible();
      await jobRow.getByRole("link", { name: "Anzeigen" }).click();

      await expect(page.getByText("Job-Details")).toBeVisible();
      await expect(page.getByText(hl7Identifier).first()).toBeVisible();

      const reviewRow = page.getByRole("row", { name: new RegExp(`Laborwert Pruefung UNKNOWN_LAB_MAPPING ${hl7Identifier} Geprueft`) }).first();
      await expect(reviewRow).toBeVisible();
      const reviewResponse = await page.evaluate(async ({ resultId }) => {
        const formData = new FormData();
        formData.set("resultId", resultId);
        formData.set("reviewNote", "Mapping wird separat angelegt");
        const response = await fetch("/api/admin/integrations/hl7/review-result", {
          method: "POST",
          headers: { Accept: "application/json" },
          body: formData,
        });
        return { ok: response.ok, body: await response.json() };
      }, { resultId: result.id });

      expect(reviewResponse.ok).toBe(true);
      await page.reload();
      await expect(page.getByRole("row", { name: new RegExp(`UNKNOWN_LAB_MAPPING ${hl7Identifier} Geprueft`) })).toHaveCount(0);
    } finally {
      await admin.from("hl7_import_jobs").delete().eq("id", job.id);
    }
  });

  test("loads live data source catalog on datenbank page", async ({ page }) => {
    await page.goto("/datenbank");

    await expect(page.getByRole("heading", { name: "Datenbankstatus" })).toBeVisible();
    await expect(page.getByText("Katalogstatus")).toBeVisible();
    await expect(page.getByText("Datenbankhistorie")).toBeVisible();
    await expect(page.getByText("Lebensmittelreferenzen ersetzen")).toBeVisible();
    await expect(page.getByText("Ersetzungsprotokoll")).toBeVisible();
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
