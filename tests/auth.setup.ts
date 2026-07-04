import { test as setup } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_STATE_PATH = "tests/.auth/user.json";

const TEST_EMAIL = "test@prodi.local";
const TEST_PASSWORD = "test-password-123!";

async function ensureOwnerMembership(admin: SupabaseClient, userId: string, email: string) {
  const { data: existing } = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existing?.organization_id) {
    await admin
      .from("organization_memberships")
      .update({ role: "owner", updated_at: new Date().toISOString() })
      .eq("organization_id", existing.organization_id)
      .eq("user_id", userId);
    return;
  }

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .insert({
      name: "Playwright Test Organisation",
      created_by: userId,
    })
    .select("id")
    .single();

  if (organizationError) throw new Error(`Failed to create test organization: ${organizationError.message}`);

  const { error: membershipError } = await admin.from("organization_memberships").insert({
    organization_id: organization.id,
    user_id: userId,
    email,
    display_name: "Playwright Test User",
    role: "owner",
    status: "active",
    joined_at: new Date().toISOString(),
  });

  if (membershipError) throw new Error(`Failed to create test owner membership: ${membershipError.message}`);
}

/**
 * Global setup: ensure a test user exists in local Supabase,
 * log in via the UI, and persist the session as storageState
 * so all subsequent specs are already authenticated.
 */
setup("authenticate", async ({ page }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Use the service-role client to create / ensure the test user exists
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Try to find existing user first
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(
    (u) => u.email === TEST_EMAIL,
  );

  let userId = existing?.id;

  if (!existing) {
    const { error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: "Playwright",
        last_name: "User",
        role: "admin",
      },
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    const { data: users } = await admin.auth.admin.listUsers();
    userId = users.users.find((u) => u.email === TEST_EMAIL)?.id;
  }

  if (!userId) throw new Error("Failed to resolve test user id");
  await ensureOwnerMembership(admin, userId, TEST_EMAIL);

  // Log in through the actual UI so cookies / storage are set correctly
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(TEST_EMAIL);
  await page.getByLabel("Passwort").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /anmelden/i }).click();

  // Wait for redirect to dashboard (proves auth succeeded)
  await page.waitForURL("**/dashboard", { timeout: 30_000 });

  // Persist the authenticated browser state
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
