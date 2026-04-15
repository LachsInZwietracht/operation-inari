import { test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const STORAGE_STATE_PATH = "tests/.auth/user.json";

const TEST_EMAIL = "test@prodi.local";
const TEST_PASSWORD = "test-password-123!";

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

  if (!existing) {
    const { error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
  }

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
