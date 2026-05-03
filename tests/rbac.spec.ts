import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_PASSWORD = "test-password-123!";

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type TestRole = "owner" | "dietitian" | "institution_admin";

async function ensureUser(email: string, role: TestRole) {
  const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw new Error(listError.message);

  let user = existingUsers.users.find((entry) => entry.email === email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: "RBAC",
        last_name: role,
        role: role === "dietitian" ? "ernaehrungsberater" : "admin",
      },
    });
    if (error) throw new Error(error.message);
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: TEST_PASSWORD,
      user_metadata: {
        first_name: "RBAC",
        last_name: role,
        role: role === "dietitian" ? "ernaehrungsberater" : "admin",
      },
    });
    if (error) throw new Error(error.message);
    user = data.user;
  }

  const { data: existingMembership } = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let organizationId = existingMembership?.organization_id as string | undefined;
  if (!organizationId) {
    const { data: organization, error } = await admin
      .from("organizations")
      .insert({
        name: `RBAC ${role} Organisation`,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    organizationId = organization.id;
  }

  const { error: membershipError } = await admin
    .from("organization_memberships")
    .upsert(
      {
        organization_id: organizationId,
        user_id: user.id,
        email,
        display_name: `RBAC ${role}`,
        role,
        status: "active",
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" },
    );

  if (membershipError) throw new Error(membershipError.message);

  return { user, organizationId: organizationId as string };
}

async function ensureMembershipInOrganization(email: string, role: TestRole, organizationId: string) {
  const { user } = await ensureUser(email, role);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("organization_memberships")
    .upsert(
      {
        organization_id: organizationId,
        user_id: user.id,
        email,
        display_name: `RBAC ${role}`,
        role,
        status: "active",
        joined_at: now,
        updated_at: now,
      },
      { onConflict: "organization_id,user_id" },
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /anmelden/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
}

test.describe("RBAC route guards", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects anonymous users from protected pages to login", async ({ page }) => {
    await page.goto("/patienten");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("allows owners to access persisted admin team management", async ({ page }) => {
    const email = "rbac-owner@prodi.local";
    await ensureUser(email, "owner");
    await login(page, email);

    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Admin & Sicherheit" })).toBeVisible();
    await expect(page.getByText("Teammitglied einladen")).toBeVisible();
    await expect(page.getByText("Teammitglieder")).toBeVisible();
    await expect(page.getByRole("cell", { name: email })).toBeVisible();
    await expect(page.getByRole("button", { name: "Speichern" }).first()).toBeVisible();
  });

  test("lets owners change team roles and writes an audit log", async ({ page }) => {
    const ownerEmail = "rbac-owner-role-change@prodi.local";
    const targetEmail = "rbac-role-target@prodi.local";
    const { organizationId } = await ensureUser(ownerEmail, "owner");
    const membershipId = await ensureMembershipInOrganization(targetEmail, "dietitian", organizationId);

    await login(page, ownerEmail);

    await page.goto("/admin/users");
    const targetRow = page.getByRole("row", { name: new RegExp(targetEmail) });
    await targetRow.getByLabel(`Rolle fuer ${targetEmail}`).selectOption("institution_admin");
    await targetRow.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText(`Zugriff fuer ${targetEmail} wurde aktualisiert.`)).toBeVisible();

    const { data: membership, error: membershipError } = await admin
      .from("organization_memberships")
      .select("role,status")
      .eq("id", membershipId)
      .single();

    if (membershipError) throw new Error(membershipError.message);
    expect(membership).toMatchObject({ role: "institution_admin", status: "active" });

    const { data: auditLog, error: auditError } = await admin
      .from("access_audit_logs")
      .select("action,target_id,metadata")
      .eq("action", "team_membership_updated")
      .eq("target_id", membershipId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auditError) throw new Error(auditError.message);
    expect(auditLog).toMatchObject({
      action: "team_membership_updated",
      target_id: membershipId,
      metadata: expect.objectContaining({
        email: targetEmail,
        previousRole: "dietitian",
        nextRole: "institution_admin",
      }),
    });
  });

  test("blocks regular dietitian users from admin pages", async ({ page }) => {
    const email = "rbac-dietitian@prodi.local";
    await ensureUser(email, "dietitian");
    await login(page, email);

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("allows institution admins into institution routes but not admin routes", async ({ page }) => {
    const email = "rbac-institution@prodi.local";
    await ensureUser(email, "institution_admin");
    await login(page, email);

    await page.goto("/institution/krankenhaus", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Krankenhausverwaltung" })).toBeVisible({ timeout: 30_000 });

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("requires authentication for export APIs", async ({ request }) => {
    const response = await request.post("/api/exports/datasets", {
      data: {
        format: "CSV",
        scope: "Lebensmittel",
      },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "AUTH_REQUIRED" });
  });
});
