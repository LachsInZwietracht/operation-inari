import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "test@prodi.local";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type AppointmentFixtureInput = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "beratung" | "kontrolle" | "team" | "webinar";
  location?: string;
  patientId?: string;
  recurring?: string;
  reminder?: string;
};

type CreatedAppointment = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
};

async function getTestUserId() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  const user = data.users.find((entry) => entry.email === TEST_EMAIL);
  if (!user) throw new Error("Test user not found");
  return user.id;
}

async function createAppointmentFixture(input: AppointmentFixtureInput): Promise<CreatedAppointment> {
  const userId = await getTestUserId();
  const suffix = Math.random().toString(36).slice(2, 8);
  const uniqueTitle = `${input.title} ${suffix}`;

  const { data, error } = await admin
    .from("appointments")
    .insert({
      user_id: userId,
      title: uniqueTitle,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      type: input.type,
      location: input.location ?? null,
      patient_id: input.patientId ?? null,
      recurring: input.recurring ?? null,
      reminder: input.reminder ?? null,
    })
    .select("id, title, date, start_time, end_time, type")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    title: data.title,
    date: data.date,
    startTime: data.start_time,
    endTime: data.end_time,
    type: data.type,
  };
}

async function deleteAppointmentFixture(appointmentId: string) {
  const { error } = await admin.from("appointments").delete().eq("id", appointmentId);
  if (error) {
    throw new Error(error.message);
  }
}

test.describe("Appointment Persistence", () => {
  test("displays appointments from Supabase", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const appointment = await createAppointmentFixture({
      title: "Supabase Termin",
      date: today,
      startTime: "10:00",
      endTime: "11:00",
      type: "beratung",
      location: "Raum 1",
    });

    try {
      await page.goto("/termine", { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(appointment.title)).toBeVisible({ timeout: 30_000 });
    } finally {
      await deleteAppointmentFixture(appointment.id);
    }
  });

  test("creates appointment via UI and persists to Supabase", async ({ page }) => {
    const uniqueSuffix = Date.now().toString().slice(-6);
    const title = `UITermin ${uniqueSuffix}`;
    const today = new Date().toISOString().slice(0, 10);

    await page.goto("/termine", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    // Open the new appointment dialog
    await page.getByRole("button", { name: /Neuer Termin/i }).click();
    await expect(page.getByText("Neuen Termin planen")).toBeVisible();

    // Fill form
    await page.locator("#title").fill(title);
    await page.locator("#date").fill(today);
    await page.locator('input[type="time"]').first().fill("14:00");
    await page.locator('input[type="time"]').last().fill("15:00");

    // Submit
    await page.getByRole("button", { name: "Speichern" }).click();

    // Verify toast
    await expect(page.getByText("Termin angelegt")).toBeVisible({ timeout: 10_000 });

    // Wait for persistence
    await page.waitForTimeout(2000);

    // Verify in Supabase
    const userId = await getTestUserId();
    const { data, error } = await admin
      .from("appointments")
      .select("id, title")
      .eq("user_id", userId)
      .eq("title", title)
      .single();

    try {
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data!.title).toBe(title);
    } finally {
      if (data?.id) {
        await deleteAppointmentFixture(data.id);
      }
    }
  });

  test("deletes appointment and removes from Supabase", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const appointment = await createAppointmentFixture({
      title: "Löschtermin",
      date: today,
      startTime: "16:00",
      endTime: "17:00",
      type: "kontrolle",
    });

    try {
      await page.goto("/termine", { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(appointment.title)).toBeVisible({ timeout: 30_000 });

      // Find the appointment card containing our title, then click its Bearbeiten button
      const appointmentCard = page.locator("div.rounded-lg.border", { hasText: appointment.title }).first();
      await appointmentCard.getByRole("button", { name: "Bearbeiten" }).click();

      await expect(page.getByText("Termin bearbeiten")).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: "Termin löschen" }).click();

      // Verify toast
      await expect(page.getByText("Termin gelöscht")).toBeVisible({ timeout: 10_000 });

      // Wait for deletion to propagate
      await page.waitForTimeout(2000);

      // Verify removed from Supabase
      const { data } = await admin
        .from("appointments")
        .select("id")
        .eq("id", appointment.id);

      expect(data).toHaveLength(0);
    } catch {
      // Cleanup if test fails before deletion
      await deleteAppointmentFixture(appointment.id).catch(() => {});
      throw new Error("Delete test failed");
    }
  });
});
