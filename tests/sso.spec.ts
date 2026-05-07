import { expect, test } from "@playwright/test";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

import { completeVerifiedSsoLogin, resolveSsoRoleFromClaims } from "@/lib/data/sso";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("SSO admin foundation", () => {
  test("persists an organization SSO config and resolves login domains", async ({ page, request }) => {
    const suffix = uniqueSuffix();
    const domain = `sso-${suffix}.clinic.test`;
    const claimValue = `nutrition-admins-${suffix}`;

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

    await page.locator("#sso-mapping-claim-name").fill("groups");
    await page.locator("#sso-mapping-claim-value").fill(claimValue);
    await page.locator("#sso-mapping-role").selectOption("institution_admin");
    await page.locator("#sso-mapping-priority").fill("10");
    await page.getByRole("button", { name: "Zuordnung speichern" }).click();

    await expect(page.getByText("SSO-Rollenzuordnung wurde gespeichert.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("row", { name: new RegExp(`groups ${claimValue} Institution Admin 10 Aktiv`) }).first()).toBeVisible({ timeout: 15_000 });

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

  test("resolves SSO claim mappings by priority and rejects ambiguous top matches", async () => {
    const suffix = uniqueSuffix();
    const domain = `claims-${suffix}.clinic.test`;
    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .insert({ name: `Claim Mapping Test ${suffix}` })
      .select("id")
      .single();
    if (organizationError) throw new Error(organizationError.message);

    try {
      const { data: config, error: configError } = await admin
        .from("organization_sso_configs")
        .insert({
          organization_id: organization.id,
          provider_type: "oidc",
          status: "active",
          display_name: "Claim Mapping SSO",
          domains: [domain],
          issuer_url: `https://login.${domain}/issuer`,
          login_hint_parameter: "login_hint",
        })
        .select("id")
        .single();
      if (configError) throw new Error(configError.message);

      const { error: mappingError } = await admin.from("sso_group_role_mappings").insert([
        {
          organization_id: organization.id,
          sso_config_id: config.id,
          claim_name: "groups",
          claim_value: "nutrition-admins",
          role: "admin",
          priority: 10,
        },
        {
          organization_id: organization.id,
          sso_config_id: config.id,
          claim_name: "groups",
          claim_value: "nutrition-team",
          role: "dietitian",
          priority: 20,
        },
      ]);
      if (mappingError) throw new Error(mappingError.message);

      const prioritized = await resolveSsoRoleFromClaims(
        {
          organizationId: organization.id,
          ssoConfigId: config.id,
          claims: { groups: ["nutrition-team", "nutrition-admins"] },
        },
        admin,
      );
      expect(prioritized).toMatchObject({ status: "matched", role: "admin" });

      const ownerPreserved = await resolveSsoRoleFromClaims(
        {
          organizationId: organization.id,
          ssoConfigId: config.id,
          existingRole: "owner",
          claims: { groups: ["nutrition-team"] },
        },
        admin,
      );
      expect(ownerPreserved).toMatchObject({
        status: "owner_preserved",
        role: "owner",
        reason: "ACTIVE_OWNER_NOT_CHANGED_BY_SSO",
      });

      const { error: ambiguousMappingError } = await admin.from("sso_group_role_mappings").insert({
        organization_id: organization.id,
        sso_config_id: config.id,
        claim_name: "roles",
        claim_value: "nutrition-leads",
        role: "institution_admin",
        priority: 10,
      });
      if (ambiguousMappingError) throw new Error(ambiguousMappingError.message);

      const ambiguous = await resolveSsoRoleFromClaims(
        {
          organizationId: organization.id,
          ssoConfigId: config.id,
          claims: { groups: ["nutrition-admins"], roles: ["nutrition-leads"] },
        },
        admin,
      );
      expect(ambiguous).toMatchObject({
        status: "ambiguous",
        reason: "MULTIPLE_SSO_MAPPINGS_WITH_SAME_PRIORITY",
      });
      expect(ambiguous.matchedMappingIds).toHaveLength(2);
    } finally {
      await admin.from("organizations").delete().eq("id", organization.id);
    }
  });

  test("applies verified SSO callback claims to organization membership", async () => {
    const suffix = uniqueSuffix();
    const domain = `callback-${suffix}.clinic.test`;
    const email = `sso-user-${suffix}@${domain}`;
    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .insert({ name: `SSO Callback Test ${suffix}` })
      .select("id")
      .single();
    if (organizationError) throw new Error(organizationError.message);

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: "Ignored Mutable Name" },
    });
    if (authError) throw new Error(authError.message);
    if (!authUser.user) throw new Error("SSO callback test user not created");

    try {
      const { data: config, error: configError } = await admin
        .from("organization_sso_configs")
        .insert({
          organization_id: organization.id,
          provider_type: "oidc",
          status: "active",
          display_name: "Callback SSO",
          domains: [domain],
          issuer_url: `https://login.${domain}/issuer`,
          login_hint_parameter: "login_hint",
        })
        .select("id")
        .single();
      if (configError) throw new Error(configError.message);

      const { error: mappingError } = await admin.from("sso_group_role_mappings").insert({
        organization_id: organization.id,
        sso_config_id: config.id,
        claim_name: "groups",
        claim_value: "nutrition-team",
        role: "dietitian",
        priority: 10,
      });
      if (mappingError) throw new Error(mappingError.message);

      const verifiedUser = {
        ...authUser.user,
        is_sso_user: true,
        identities: [
          {
            id: `identity-${suffix}`,
            identity_id: `identity-${suffix}`,
            user_id: authUser.user.id,
            provider: "sso",
            identity_data: {
              groups: ["nutrition-team"],
              name: "Verified IdP Name",
            },
          },
        ],
      } as User;

      const result = await completeVerifiedSsoLogin(verifiedUser, admin);
      expect(result).toMatchObject({
        status: "applied",
        organizationId: organization.id,
        role: "dietitian",
        resolution: { status: "matched", role: "dietitian" },
      });

      const { data: membership, error: membershipError } = await admin
        .from("organization_memberships")
        .select("email,display_name,role,status")
        .eq("organization_id", organization.id)
        .eq("user_id", authUser.user.id)
        .maybeSingle();
      if (membershipError) throw new Error(membershipError.message);
      expect(membership).toMatchObject({
        email,
        display_name: "Verified IdP Name",
        role: "dietitian",
        status: "active",
      });
    } finally {
      await admin.from("organizations").delete().eq("id", organization.id);
      await admin.auth.admin.deleteUser(authUser.user.id);
    }
  });

});

test.describe("SSO login routing", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows prepared SSO login path for configured domains", async ({ page }) => {
    const domain = `login-${uniqueSuffix()}.clinic.test`;
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
