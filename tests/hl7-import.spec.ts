import { expect, test, type Page } from "@playwright/test";

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

async function cleanupHl7Fixture(sourceSystem: string) {
  const userId = await getTestUserId();
  const organizationId = await getTestOrganizationId(userId);

  const { data: patients } = await admin
    .from("patients")
    .select("id")
    .eq("user_id", userId)
    .like("legacy_id", `${sourceSystem}:%`);
  const patientIds = (patients ?? []).map((patient) => patient.id as string);
  if (patientIds.length > 0) {
    await admin.from("patient_lab_values").delete().in("patient_id", patientIds);
    await admin.from("patients").delete().in("id", patientIds);
  }

  await admin.from("hl7_import_jobs").delete().eq("organization_id", organizationId).eq("source_system", sourceSystem);
  await admin
    .from("hl7_lab_parameter_mappings")
    .delete()
    .eq("organization_id", organizationId)
    .eq("source_system", sourceSystem);
}

async function createLabMapping(sourceSystem: string, hl7Identifier = "4548-4") {
  const userId = await getTestUserId();
  const organizationId = await getTestOrganizationId(userId);
  const { error } = await admin.from("hl7_lab_parameter_mappings").insert({
    organization_id: organizationId,
    source_system: sourceSystem,
    hl7_identifier: hl7Identifier,
    hl7_text: "HbA1c",
    hl7_coding_system: "LN",
    parameter_id: "lab_hba1c",
    unit: "%",
    status: "active",
  });
  if (error) throw new Error(error.message);
}

async function postHl7(page: Page, body: Record<string, unknown>) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30_000 });
  return page.evaluate(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/integrations/hl7/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return {
      status: response.status,
      body: await response.json(),
    };
  }, body);
}

function adtMessage(
  controlId: string,
  patientId: string,
  lastName = "Schmidt",
  firstName = "Lena",
  dateOfBirth = "19800102",
) {
  return [
    `MSH|^~\\&|KIS|HOSP|INARI|APP|202605050900||ADT^A08|${controlId}|P|2.5`,
    `PID|||${patientId}^^^KIS||${lastName}^${firstName}||${dateOfBirth}|F|||Musterstrasse 1^^Koeln^^50667||+49221123456`,
  ].join("\r");
}

function oruMessage(
  controlId: string,
  patientId: string,
  obxIdentifier = "4548-4",
  lastName = "Schmidt",
  firstName = "Lena",
  dateOfBirth = "19800102",
) {
  return [
    `MSH|^~\\&|LAB|HOSP|INARI|APP|202605050900||ORU^R01|${controlId}|P|2.5`,
    `PID|||${patientId}^^^KIS||${lastName}^${firstName}||${dateOfBirth}|F|||Musterstrasse 1^^Koeln^^50667||+49221123456`,
    "OBR|1|||LABPANEL^Basislabor",
    `OBX|1|NM|${obxIdentifier}^HbA1c^LN||6.8|%|4.0-6.0|H|||F|||202605050830`,
  ].join("\r");
}

test.describe("HL7 v2 import MVP", () => {
  test("imports ADT patient messages and is idempotent by message control ID", async ({ page }) => {
    const sourceSystem = `hl7-adt-${Date.now()}`;
    await cleanupHl7Fixture(sourceSystem);

    try {
      const message = adtMessage("ADT-1", "P-1001", "Adtpatient", "Lena", "19800103");
      const first = await postHl7(page, { sourceSystem, message });
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        status: "imported",
        duplicate: false,
        counts: { patientsCreated: 1 },
      });

      const second = await postHl7(page, { sourceSystem, message });
      expect(second.status).toBe(200);
      expect(second.body).toMatchObject({
        duplicate: true,
        counts: { patientsCreated: 1 },
      });

      const { data: patient, error } = await admin
        .from("patients")
        .select("*")
        .eq("legacy_id", `${sourceSystem}:KIS:P-1001`)
        .single();
      if (error) throw new Error(error.message);
      expect(patient).toMatchObject({
        first_name: "Lena",
        last_name: "Adtpatient",
        date_of_birth: "1980-01-03",
        gender: "w",
        city: "Koeln",
        zip: "50667",
      });
    } finally {
      await cleanupHl7Fixture(sourceSystem);
    }
  });

  test("imports numeric ORU observations into patient lab values", async ({ page }) => {
    const sourceSystem = `hl7-oru-${Date.now()}`;
    await cleanupHl7Fixture(sourceSystem);

    try {
      await createLabMapping(sourceSystem);
      const result = await postHl7(page, {
        sourceSystem,
        message: oruMessage("ORU-1", "P-2001", "4548-4", "Orupatient", "Lena", "19800104"),
      });

      expect(result.status).toBe(201);
      expect(result.body).toMatchObject({
        status: "imported",
        counts: { patientsCreated: 1, labValuesCreated: 1 },
      });

      const { data: labValue, error } = await admin
        .from("patient_lab_values")
        .select("*,patients!inner(legacy_id)")
        .eq("patients.legacy_id", `${sourceSystem}:KIS:P-2001`)
        .single();
      if (error) throw new Error(error.message);
      expect(labValue).toMatchObject({
        parameter_id: "lab_hba1c",
        date: "2026-05-05",
        notes: "HL7 Import",
      });
      expect(Number(labValue.value)).toBe(6.8);
      expect(labValue.metadata).toMatchObject({
        source: "hl7",
        sourceSystem,
        messageControlId: "ORU-1",
        hl7Identifier: "4548-4",
        unit: "%",
        referenceRange: "4.0-6.0",
        abnormalFlags: ["H"],
        resultStatus: "F",
      });
    } finally {
      await cleanupHl7Fixture(sourceSystem);
    }
  });

  test("keeps unknown OBX identifiers in review instead of inventing lab mappings", async ({ page }) => {
    const sourceSystem = `hl7-review-${Date.now()}`;
    await cleanupHl7Fixture(sourceSystem);

    try {
      const result = await postHl7(page, {
        sourceSystem,
        message: oruMessage("ORU-UNKNOWN", "P-3001", "99999-9", "Reviewpatient", "Lena", "19800105"),
      });

      expect(result.status).toBe(201);
      expect(result.body).toMatchObject({
        status: "needs_review",
        counts: { patientsCreated: 1, needsReview: 1 },
      });
      expect(result.body.reviewItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reason: "UNKNOWN_LAB_MAPPING",
            hl7Identifier: "99999-9",
          }),
        ]),
      );
    } finally {
      await cleanupHl7Fixture(sourceSystem);
    }
  });

  test("stops ambiguous patient matches for review", async ({ page }) => {
    const sourceSystem = `hl7-ambiguous-${Date.now()}`;
    const userId = await getTestUserId();
    const firstName = "Lena";
    const lastName = `Ambiguous${Date.now()}`;
    const dateOfBirth = "1980-01-06";
    await cleanupHl7Fixture(sourceSystem);

    try {
      const duplicateRows = [1, 2].map((index) => ({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        gender: "w",
        insurance_provider: "HL7 Test",
        insurance_number: `${sourceSystem}-${index}`,
        indication: "HL7 Test",
      }));
      const { error } = await admin.from("patients").insert(duplicateRows);
      if (error) throw new Error(error.message);

      const result = await postHl7(page, {
        sourceSystem,
        message: adtMessage("ADT-AMBIGUOUS", "P-4001", lastName, firstName, "19800106"),
      });

      expect(result.status).toBe(201);
      expect(result.body).toMatchObject({
        status: "needs_review",
        counts: { needsReview: 1 },
      });
      expect(result.body.reviewItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reason: "AMBIGUOUS_PATIENT_MATCH",
          }),
        ]),
      );
    } finally {
      const { data: patients } = await admin
        .from("patients")
        .select("id")
        .eq("user_id", userId)
        .eq("first_name", firstName)
        .eq("last_name", lastName)
        .eq("date_of_birth", dateOfBirth);
      const patientIds = (patients ?? []).map((patient) => patient.id as string);
      if (patientIds.length > 0) await admin.from("patients").delete().in("id", patientIds);
      await cleanupHl7Fixture(sourceSystem);
    }
  });
});
