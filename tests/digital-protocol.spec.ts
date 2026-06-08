import { expect, test } from "@playwright/test";

import {
  createClinicDemoDigitalProtocolLink,
  createClinicDemoPatient,
  createClinicDemoProtocol,
  deleteClinicDemoPatient,
  fetchClinicDemoFoodForSmartMatch,
  fetchClinicDemoProtocol,
  fetchDigitalProtocolLink,
  fetchDigitalProtocolSubmissionByLink,
  fetchLatestAccessAuditLog,
} from "./fixtures/clinic-demo";

test.describe("Digital Protocol Public Entry", () => {
  test("invalid UUID shows not-found message", async ({ page }) => {
    await page.goto("/protokoll/not-a-uuid", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await expect(page.getByText("Link nicht gefunden")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("non-existent UUID shows not-found message", async ({ page }) => {
    await page.goto("/protokoll/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await expect(
      page.getByText(/nicht gefunden|nicht existiert/)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("page has correct metadata title", async ({ page }) => {
    await page.goto("/protokoll/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await expect(page).toHaveTitle(/Ernährungsprotokoll.*Inari/);
  });

  test("public route has no sidebar or app shell", async ({ page }) => {
    await page.goto("/protokoll/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    // No sidebar should be visible on the public route
    await expect(
      page.locator("[data-slot='sidebar-container']")
    ).not.toBeVisible();
  });

  test("submission API rejects invalid body", async ({ request }) => {
    const response = await request.post("/api/protokoll/submit", {
      data: { invalid: true },
    });
    expect(response.status()).toBe(400);
  });

  test("submission API rejects non-existent link", async ({ request }) => {
    const response = await request.post("/api/protokoll/submit", {
      data: {
        linkId: "00000000-0000-0000-0000-000000000000",
        days: [
          {
            date: "2026-04-19",
            entries: [
              {
                mealSlot: "fruehstueck",
                freeText: "Toast mit Butter",
              },
            ],
          },
        ],
      },
    });
    // Either 404 (not found) or 500 (service client placeholder) depending on env
    expect([404, 500]).toContain(response.status());
  });

  test("conversion API rejects invalid body", async ({ request }) => {
    const response = await request.post("/api/digital-protocol-submissions/convert", {
      data: { invalid: true },
    });
    expect(response.status()).toBe(400);
  });

  test("mobile viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/protokoll/00000000-0000-0000-0000-000000000000", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    // Page should still render the error state without layout issues
    const content = page.locator("main");
    await expect(content).toBeVisible({ timeout: 10_000 });
  });

  test("persists public submission and tracks practitioner conversion", async ({ page }) => {
    test.setTimeout(60_000);

    const patient = await createClinicDemoPatient({
      firstName: "Digital",
      lastName: "Recall",
      indications: ["Adipositas"],
    });
    const link = await createClinicDemoDigitalProtocolLink(patient);

    try {
      await page.goto(`/protokoll/${link.id}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { name: "Ernährungsprotokoll" })).toBeVisible();
      await expect(page.getByText("Methode:")).toContainText("Digitales 24h Recall");

      const breakfastEntry = page.getByRole("textbox", {
        name: "Was haben Sie gegessen und getrunken?",
      }).first();
      await expect(breakfastEntry).toBeVisible();
      await breakfastEntry.fill("2 Scheiben Vollkornbrot mit Butter");
      await expect(breakfastEntry).toHaveValue("2 Scheiben Vollkornbrot mit Butter");
      await page.getByLabel("Uhrzeit (optional)").first().fill("08:15");
      await page
        .getByPlaceholder(/Besonderheiten/i)
        .fill("Patientin berichtet normalen Appetit, keine Beschwerden.");
      await page.getByRole("button", { name: "Absenden" }).click();

      await expect(page.getByRole("heading", { name: "Vielen Dank!" })).toBeVisible({ timeout: 30_000 });

      const storedLink = await fetchDigitalProtocolLink(link.id);
      expect(storedLink).toMatchObject({
        id: link.id,
        patient_id: patient.id,
        status: "received",
      });

      const submission = await fetchDigitalProtocolSubmissionByLink(link.id);
      expect(submission).toBeTruthy();
      expect(submission).toMatchObject({
        link_id: link.id,
        patient_id: patient.id,
        status: "new",
        converted_protocol_id: null,
      });
      expect(submission.notes).toContain("normalen Appetit");
      expect(submission.days[0].entries[0]).toMatchObject({
        mealSlot: "fruehstueck",
        freeText: "2 Scheiben Vollkornbrot mit Butter",
        time: "08:15",
      });

      await expect
        .poll(async () => fetchLatestAccessAuditLog("digital_protocol_submission_received", submission.id))
        .toMatchObject({
          action: "digital_protocol_submission_received",
          target_type: "digital_protocol_submission",
          target_id: submission.id,
          metadata: expect.objectContaining({
            patientId: patient.id,
            linkId: link.id,
            dayCount: 1,
            entryCount: 1,
            submittedBy: "patient_portal",
          }),
        });

      const protocolId = await createClinicDemoProtocol(patient, { submissionId: submission.id });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30_000 });
      const conversion = await page.evaluate(
        async ({ submissionId, protocolId }) => {
          const response = await fetch("/api/digital-protocol-submissions/convert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ submissionId, protocolId }),
          });
          return {
            status: response.status,
            body: await response.json(),
          };
        },
        { submissionId: submission.id, protocolId },
      );

      expect(conversion.status).toBe(200);
      expect(conversion.body.submission).toMatchObject({
        id: submission.id,
        status: "converted",
        converted_protocol_id: protocolId,
      });

      const convertedSubmission = await fetchDigitalProtocolSubmissionByLink(link.id);
      expect(convertedSubmission).toMatchObject({
        id: submission.id,
        status: "converted",
        converted_protocol_id: protocolId,
      });

      await expect
        .poll(async () => fetchLatestAccessAuditLog("digital_protocol_submission_converted", submission.id))
        .toMatchObject({
          action: "digital_protocol_submission_converted",
          target_type: "digital_protocol_submission",
          target_id: submission.id,
          metadata: expect.objectContaining({
            patientId: patient.id,
            linkId: link.id,
            protocolId,
          }),
        });
    } finally {
      await deleteClinicDemoPatient(patient.id);
    }
  });

  test("drives Smart-Match practitioner review into a saved protocol", async ({ page }) => {
    test.setTimeout(90_000);

    const food = await fetchClinicDemoFoodForSmartMatch();
    const patient = await createClinicDemoPatient({
      firstName: "Smart",
      lastName: "Match",
      indications: ["Diabetes mellitus Typ 2"],
    });
    const link = await createClinicDemoDigitalProtocolLink(patient);

    try {
      await page.goto(`/protokoll/${link.id}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForLoadState("networkidle");

      await page
        .getByRole("textbox", { name: "Was haben Sie gegessen und getrunken?" })
        .first()
        .fill(food.name);
      await page.getByLabel("Uhrzeit (optional)").first().fill("09:10");
      await page
        .getByPlaceholder(/Besonderheiten/i)
        .fill("Smart-Match E2E: exakt benanntes Lebensmittel aus der Datenbank.");
      await page.getByRole("button", { name: "Absenden" }).click();
      await expect(page.getByRole("heading", { name: "Vielen Dank!" })).toBeVisible({ timeout: 30_000 });

      const submission = await fetchDigitalProtocolSubmissionByLink(link.id);
      expect(submission).toBeTruthy();
      expect(submission.status).toBe("new");

      await page.goto(`/patienten/${patient.id}/protokolle/neu?digitalSubmission=${submission.id}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      await expect(page.getByRole("heading", { name: "Smart-Match Überprüfung" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(food.name).first()).toBeVisible();
      await page.getByRole("button", { name: /Übernehmen \(/ }).click();

      await expect(page.getByRole("heading", { name: "Digitales Protokoll uebernehmen" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByLabel("Titel")).toHaveValue(/Digitales Protokoll vom/);
      await expect(page.getByText(food.name).first()).toBeVisible();

      await page.getByRole("button", { name: "Protokoll erstellen" }).click();
      await expect(page.getByRole("heading", { name: "Einreichung bereits uebernommen" })).toBeVisible({
        timeout: 30_000,
      });
      const protocolHref = await page.getByRole("link", { name: "Protokoll oeffnen" }).getAttribute("href");
      expect(protocolHref).toMatch(/\/patienten\/[^/]+\/protokolle\/[0-9a-f-]{36}$/i);

      const protocolId = protocolHref?.split("/").pop();
      expect(protocolId).toMatch(/^[0-9a-f-]{36}$/i);

      const convertedSubmission = await fetchDigitalProtocolSubmissionByLink(link.id);
      expect(convertedSubmission).toMatchObject({
        id: submission.id,
        status: "converted",
        converted_protocol_id: protocolId,
      });

      const protocol = await fetchClinicDemoProtocol(protocolId!);
      expect(protocol).toMatchObject({
        id: protocolId,
        patient_id: patient.id,
        type: "ernaehrungsprotokoll",
      });
      expect(protocol?.metadata).toMatchObject({
        source: "digital_protocol_submission",
        sourceSubmissionId: submission.id,
      });
      expect(protocol?.nutrition_protocol_entries?.[0]).toMatchObject({
        food_id: food.id,
        meal_slot: "fruehstueck",
        entry_time: "09:10",
      });

      await expect
        .poll(async () => fetchLatestAccessAuditLog("digital_protocol_submission_converted", submission.id))
        .toMatchObject({
          action: "digital_protocol_submission_converted",
          target_type: "digital_protocol_submission",
          target_id: submission.id,
          metadata: expect.objectContaining({
            patientId: patient.id,
            linkId: link.id,
            protocolId,
          }),
        });
    } finally {
      await deleteClinicDemoPatient(patient.id);
    }
  });
});
