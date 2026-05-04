import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

test.describe("SSO admin foundation", () => {
  test("persists an organization SSO config and resolves login domains", async ({ page, request }) => {
    const domain = `sso-${Date.now()}.clinic.test`;

    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Admin & Sicherheit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "SSO-Konfiguration speichern" })).toBeVisible();

    await page.locator("#sso-display-name").fill("Playwright Klinik SSO");
    await page.locator("#sso-provider-type").selectOption("oidc");
    await page.locator("#sso-status").selectOption("active");
    await page.locator("#sso-login-hint").fill("login_hint");
    await page.locator("#sso-domains").fill(domain);
    await page.locator("#sso-issuer-url").fill(`https://login.${domain}/issuer`);
    await page.locator("#sso-metadata-url").fill(`https://login.${domain}/.well-known/openid-configuration`);
    await page.getByRole("button", { name: "SSO-Konfiguration speichern" }).click();

    await expect(page.getByText("SSO-Konfiguration wurde gespeichert.")).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(domain) }).first()).toBeVisible();

    const resolution = await request.get(`/api/sso/resolve?email=arzt@${domain}`);
    expect(resolution.status()).toBe(200);
    await expect(await resolution.json()).toMatchObject({
      matched: true,
      domain,
      providerType: "oidc",
      displayName: "Playwright Klinik SSO",
    });

    await page.getByRole("button", { name: "SSO deaktivieren" }).click();
    await expect(page.getByText("SSO-Konfiguration wurde deaktiviert.")).toBeVisible();

    const disabledResolution = await request.get(`/api/sso/resolve?email=arzt@${domain}`);
    expect(disabledResolution.status()).toBe(200);
    await expect(await disabledResolution.json()).toMatchObject({
      matched: false,
      domain,
    });
  });

});

test.describe("SSO login routing", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows prepared SSO login path for configured domains", async ({ page }) => {
    const domain = `login-${Date.now()}.clinic.test`;
    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .insert({ name: "Login SSO Test Organisation" })
      .select("id")
      .single();

    if (organizationError) throw new Error(organizationError.message);

    try {
      const { error: ssoError } = await admin.from("organization_sso_configs").insert({
        organization_id: organization.id,
        provider_type: "saml",
        status: "active",
        display_name: "Login Test SSO",
        domains: [domain],
        metadata_url: `https://idp.${domain}/metadata`,
        login_hint_parameter: "login_hint",
      });

      if (ssoError) throw new Error(ssoError.message);

      await page.goto("/login");
      await page.getByLabel("E-Mail").fill(`diaetetik@${domain}`);
      await page.getByRole("button", { name: "SSO pruefen" }).click();

      await expect(page.getByText("Login Test SSO gefunden")).toBeVisible();
      await expect(page.getByRole("button", { name: "Mit SSO anmelden" })).toBeVisible();
    } finally {
      await admin.from("organizations").delete().eq("id", organization.id);
    }
  });
});
