import { expect, test } from "@playwright/test";

import {
  admin,
  deleteClinicDemoPatient,
  getTestUserId,
} from "./fixtures/clinic-demo";

/**
 * Onboarding intake links.
 *
 * The guard-screen and API-contract tests need no database rows, so they cover
 * the public surface even on a bare environment. The end-to-end test seeds an
 * invitation through the service role, matching the production ownership
 * boundary without depending on another feature suite.
 */

const UNKNOWN_UUID = "00000000-0000-0000-0000-000000000000";

async function createIntakeLink(options: { patientId?: string; expiresAt?: string } = {}) {
  const userId = await getTestUserId();
  const { data, error } = await admin
    .from("patient_intake_links")
    .insert({
      user_id: userId,
      patient_id: options.patientId ?? null,
      label: `Playwright Einladung ${Math.random().toString(36).slice(2, 8)}`,
      status: "pending",
      expires_at: options.expiresAt ?? "2027-12-31",
    })
    .select("id, label")
    .single();

  if (error) throw new Error(error.message);
  return data as { id: string; label: string };
}

async function deleteIntakeLink(linkId: string) {
  await admin.from("patient_intake_links").delete().eq("id", linkId);
}

test.describe("Onboarding intake — public entry", () => {
  test("invalid UUID shows not-found message", async ({ page }) => {
    await page.goto("/onboarding/not-a-uuid", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: "Link nicht gefunden" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("unknown UUID shows not-found message", async ({ page }) => {
    await page.goto(`/onboarding/${UNKNOWN_UUID}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: "Link nicht gefunden" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("public route has no app shell", async ({ page }) => {
    await page.goto(`/onboarding/${UNKNOWN_UUID}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await expect(page.locator("[data-slot='sidebar-container']")).not.toBeVisible();
  });

  test("page has correct metadata title", async ({ page }) => {
    await page.goto(`/onboarding/${UNKNOWN_UUID}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await expect(page).toHaveTitle(/Onboarding.*Inari/);
  });

  test("submit API rejects an invalid body", async ({ request }) => {
    const response = await request.post("/api/onboarding/submit", {
      data: { invalid: true },
    });
    expect(response.status()).toBe(400);
  });

  test("submit API rejects an unknown link", async ({ request }) => {
    const response = await request.post("/api/onboarding/submit", {
      data: {
        linkId: UNKNOWN_UUID,
        payload: {
          person: {
            firstName: "Test",
            lastName: "Person",
            dateOfBirth: "1990-01-01",
            gender: "w",
          },
          goal: { primaryGoal: "abnehmen" },
          body: { heightCm: 175, weightKg: 72 },
          consent: { dataProcessing: true },
        },
      },
    });
    expect(response.status()).toBe(404);
  });
});

test.describe("Onboarding intake — expired and revoked links", () => {
  test("expired link shows the expiry screen", async ({ page }) => {
    const link = await createIntakeLink({ expiresAt: "2020-01-01" });
    try {
      await page.goto(`/onboarding/${link.id}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await expect(
        page.getByRole("heading", { name: "Link abgelaufen" }),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteIntakeLink(link.id);
    }
  });
});

test.describe("Onboarding intake — end to end", () => {
  test.setTimeout(60_000);

  test("fills the intake and creates a patient on apply", async ({ page, request }) => {
    const link = await createIntakeLink();
    let createdPatientId: string | undefined;

    try {
      await page.goto(`/onboarding/${link.id}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      // Step 1 — person
      await expect(page.getByRole("heading", { name: "Über dich" })).toBeVisible({
        timeout: 15_000,
      });
      await page.getByLabel("Vorname").fill("Testine");
      await page.getByLabel("Nachname").fill("Onboarding");
      await page.getByLabel("Geburtsdatum").fill("1991-05-14");
      await page.getByRole("button", { name: "Weiblich" }).click();
      await page.getByRole("button", { name: "Weiter" }).click();

      // Step 2 — goal
      await expect(page.getByRole("heading", { name: "Dein Ziel" })).toBeVisible();
      await page.getByRole("button", { name: "Abnehmen", exact: true }).click();
      await page.getByRole("button", { name: "Weiter" }).click();

      // Step 3 — body
      await expect(page.getByRole("heading", { name: "Körper" })).toBeVisible();
      await page.getByLabel("Größe in cm").fill("172");
      // Exact: "Gewicht in kg" is also a substring of "Wunschgewicht in kg".
      await page.getByLabel("Gewicht in kg", { exact: true }).fill("78");
      await page.getByRole("button", { name: "Weiter" }).click();

      // Steps 4-10 are optional; click through to the consent step.
      for (const heading of [
        "Bewegung",
        "Gesundheit",
        "Unverträglichkeiten",
        "Ernährungsform",
        "Lebensmittel",
        "Dein Alltag",
        "Erfahrung",
      ]) {
        await expect(page.getByRole("heading", { name: heading })).toBeVisible();
        await page.getByRole("button", { name: "Weiter" }).click();
      }

      // Step 11 — consent
      await expect(page.getByRole("heading", { name: "Einwilligung" })).toBeVisible();
      await page.getByRole("checkbox").first().click();
      await page.getByRole("button", { name: "Absenden" }).click();

      await expect(page.getByText("Vielen Dank!")).toBeVisible({ timeout: 15_000 });

      // The link is now consumed.
      const { data: usedLink } = await admin
        .from("patient_intake_links")
        .select("status")
        .eq("id", link.id)
        .single();
      expect(usedLink?.status).toBe("received");

      // Reopening shows the already-submitted guard.
      await page.goto(`/onboarding/${link.id}`, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: "Bereits ausgefüllt" }),
      ).toBeVisible({ timeout: 10_000 });

      // Apply the submission as the practitioner.
      const { data: submission } = await admin
        .from("patient_intake_submissions")
        .select("id")
        .eq("link_id", link.id)
        .single();

      expect(submission?.id).toBeTruthy();

      const applyResponse = await request.post("/api/patient-intake-submissions/apply", {
        data: { submissionId: submission!.id },
      });
      expect(applyResponse.ok()).toBeTruthy();

      const applyBody = (await applyResponse.json()) as { patientId: string };
      createdPatientId = applyBody.patientId;
      expect(createdPatientId).toBeTruthy();

      const { data: patient } = await admin
        .from("patients")
        .select("first_name, last_name, date_of_birth, gender, intake_reason")
        .eq("id", createdPatientId!)
        .single();

      expect(patient?.first_name).toBe("Testine");
      expect(patient?.last_name).toBe("Onboarding");
      expect(patient?.date_of_birth).toBe("1991-05-14");
      expect(patient?.intake_reason).toBe("Abnehmen");

      // The stored original stays visible from the patient record without
      // turning the editable record back into the submitted questionnaire.
      await page.goto(`/patienten/${createdPatientId}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      // The header summary lists it as a row; its accessible name carries the
      // submission date alongside the label.
      await expect(page.getByRole("button", { name: /Originalaufnahme/ })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText("Wichtige Ereignisse", { exact: true })).toBeVisible();
      await expect(page.getByText("Einladung versendet")).toBeVisible();
      await expect(page.getByText("Aufnahme eingegangen")).toBeVisible();
      await expect(page.getByText("Aufnahme übernommen")).toBeVisible();
      await page.getByRole("button", { name: /Originalaufnahme/ }).click();
      const originalIntakeDialog = page.getByRole("dialog", { name: "Originalaufnahme" });
      await expect(originalIntakeDialog).toBeVisible();
      await expect(originalIntakeDialog.getByText("Testine Onboarding")).toBeVisible();

      // Applying twice is refused rather than duplicating the patient.
      const secondApply = await request.post("/api/patient-intake-submissions/apply", {
        data: { submissionId: submission!.id },
      });
      expect(secondApply.status()).toBe(409);
    } finally {
      if (createdPatientId) {
        await deleteClinicDemoPatient(createdPatientId);
      }
      await deleteIntakeLink(link.id);
    }
  });
});

test.describe("Onboarding intake — practitioner surface", () => {
  // Onboarding never had its own tab and still does not: an invited person is
  // just an earlier stage of the intake, so inviting happens from Aufnahmen —
  // the screen that holds everyone who does not have a plan yet.
  test("Aufnahmen offers inviting without a separate tab", async ({ page }) => {
    await page.goto("/patienten/aufnahmen", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Aufnahmen" })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByRole("tab", { name: "Onboarding" })).toHaveCount(0);

    await page.getByRole("button", { name: "Einladung", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  });

  test("Aufnahmen filters by intake stage and puts it in the URL", async ({ page }) => {
    await page.goto("/patienten/aufnahmen", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("menuitem", { name: "Stufe" }).click();
    await page.getByRole("menuitem", { name: "Eingeladen" }).click();

    // The chip reads field, operator, value — and the same state is in the URL,
    // so a filtered list survives a reload and can be shared.
    await expect(page.getByRole("button", { name: /Filter Stufe entfernen/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/stufe=eingeladen/);
  });

  test("Aufnahmen switches between Liste, Zeitachse and Board", async ({ page }) => {
    await page.goto("/patienten/aufnahmen", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle");

    for (const [label, expected] of [
      ["Zeitachse", /view=zeit/],
      ["Board", /view=board/],
    ] as const) {
      await page.getByRole("tab", { name: label }).click();
      await expect(page).toHaveURL(expected, { timeout: 15_000 });
      await expect(page.getByRole("tab", { name: label })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    }
  });

  test("Aufnahmen restores the last selected view when opened from navigation", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("inari:aufnahmen:view", "board");
    });

    await page.goto("/patienten/aufnahmen", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    await expect(page).toHaveURL(/view=board/, { timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "Board" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("Board shows all four stage columns and never scrolls the page sideways", async ({
    page,
  }) => {
    // 900px is the width the old two-column grid turned into a 2x2 waffle.
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto("/patienten/aufnahmen?view=board", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle");

    for (const label of ["Eingeladen", "Fragebogen zurück", "Beratung", "Plan erstellen"]) {
      await expect(page.locator(`section[aria-label="${label}"]`)).toHaveCount(1, {
        timeout: 15_000,
      });
    }

    // The column track scrolls; the document itself must not.
    const documentOverflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(documentOverflows).toBe(false);
  });

  test("Board move menu explains what a stage still needs", async ({ page }) => {
    await page.goto("/patienten/aufnahmen?view=board", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForLoadState("networkidle");

    const card = page.locator("article[data-intake-stage]").first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    const cardName = (await card.innerText()).split("\n")[0];

    // The menu carries the same moves as the drag, without its coordinates.
    await card.hover();
    await card.getByRole("button", { name: /verschieben/ }).click();
    await page.getByRole("menuitem", { name: "Plan erstellen" }).click();

    // A stage is derived, so the dialog names the missing fact instead of
    // moving the card. It must be about the card that was actually picked.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole("heading")).toContainText(cardName);
    await expect(dialog.getByRole("heading")).toContainText("Plan erstellen");
  });
});
