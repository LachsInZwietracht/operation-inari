# Clinic IT Integration Plan

This document defines the remaining P1 clinic IT contracts after the SSO and API key foundations.

Status: SSO claim mapping and SSO callback membership application are implemented. Remaining connector work should build on the persisted schemas and acceptance criteria below, not on ad-hoc connector code.

## 1. LDAP / Active Directory Mapping

### Goal

Allow a clinic IT team to map identity-provider claims and directory groups to Operation Prodi roles without manual per-user role maintenance.

This builds on the persisted SSO foundation in `organization_sso_configs`. It does not replace Supabase Auth or local RBAC; it defines how an authenticated SSO principal should be placed into `organization_memberships`.

Status: implemented via migration `20260523000041_sso_group_role_mappings.sql`, admin forms in `/admin/users`, Supabase Auth SSO handoff from the login form, `/auth/sso/callback`, `resolveSsoRoleFromClaims()`, and `completeVerifiedSsoLogin()` in `lib/data/sso.ts`. Pre-login domain routing still does not create memberships.

### Scope

Supported identity source:
- OIDC claims from Entra ID, Keycloak, or another hospital IdP.
- SAML attributes from hospital AD FS, Shibboleth, or SAML bridge products.
- LDAP/Active Directory groups as surfaced through OIDC/SAML claims. Direct LDAP bind/sync is not part of v1.

Required mapping inputs:
- `organization_sso_config_id`
- `claim_name`, for example `groups`, `roles`, `memberOf`, `department`, `extension_Role`
- `claim_value`, for example an Entra group object ID or AD distinguished name
- target app role: `admin`, `dietitian`, `assistant`, `institution_admin`; `owner` stays a manual break-glass role
- status: `active` or `disabled`
- priority for deterministic conflict resolution

Implemented table:

```sql
CREATE TABLE sso_group_role_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sso_config_id UUID NOT NULL REFERENCES organization_sso_configs(id) ON DELETE CASCADE,
  claim_name TEXT NOT NULL,
  claim_value TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'dietitian', 'assistant', 'institution_admin')),
  priority INTEGER NOT NULL DEFAULT 100 CHECK (priority >= 0 AND priority <= 10000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sso_config_id, claim_name, claim_value)
);
```

RLS:
- Read/insert/update/delete limited to `is_organization_admin(organization_id, auth.uid())`.
- Mutations write `access_audit_logs` events with actions `sso_mapping_created`, `sso_mapping_updated`, and `sso_mapping_disabled`.

### Role Resolution Rules

1. Only active mappings on the active SSO config are considered.
2. Exact `claim_name` + `claim_value` match wins.
3. Lowest numeric `priority` wins when multiple mappings match.
4. If two mappings have the same priority, the more privileged role does not automatically win; the resolver must return a configuration error so an admin fixes ambiguity.
5. If no mapping matches, the default result is no automatic membership creation.
6. Existing active `owner` memberships are never downgraded automatically.
7. A mapped user may be added as `invited` or `active` only after the login callback verifies the SSO principal. Pre-login domain resolution must not create membership rows.

### Acceptance Criteria

- Admin UI can create, edit, disable, and list mappings under the SSO configuration.
- Mapping validation rejects unknown app roles, empty claim names, empty claim values, duplicate mappings, and invalid priorities.
- The resolver can resolve a role from verified claims without granting a role from the email domain alone.
- Audit log captures actor, mapping ID, previous role/status, next role/status, claim name/value, and SSO config ID.
- Tests cover deterministic priority, ambiguity rejection, Owner downgrade protection, and no-match behavior.

## 2. First FHIR Sync Boundary

### Sequencing

FHIR is the primary inbound interoperability boundary. It reuses the shared patient matching, lab mapping, audit, and import-review surfaces that inbound imports require.

### First Boundary

Read-only inbound sync for:
- `Patient`
- `Observation` for lab values only

FHIR resources intentionally deferred:
- `Encounter`
- `Condition`
- `MedicationStatement`
- `ServiceRequest`
- `DocumentReference`
- write-back to HIS/EHR

### Resource Mapping

FHIR `Patient`:
- `Patient.identifier` -> external patient identifier model (source prefix plus `patients.legacy_id`)
- `Patient.name[0].family` -> `patients.last_name`
- `Patient.name[0].given[0]` -> `patients.first_name`
- `Patient.birthDate` -> `patients.date_of_birth`
- `Patient.gender` -> `patients.gender`
- `Patient.telecom` -> `phone`/`email` when present
- `Patient.address[0]` -> `street`, `zip`, `city`

FHIR `Observation`:
- `Observation.subject.reference` -> resolved patient
- `Observation.code.coding[]` -> lab parameter mapping table
- `Observation.effectiveDateTime` -> `patient_lab_values.date`
- `Observation.valueQuantity.value` -> `patient_lab_values.value`
- `Observation.valueQuantity.unit` -> `patient_lab_values.metadata.unit`
- `Observation.referenceRange` -> `metadata.referenceRange`
- `Observation.interpretation` -> `metadata.abnormalFlags`
- `Observation.status` -> `metadata.resultStatus`

### Sync Contract

Recommended endpoint:
- `POST /api/integrations/fhir/sync`
- Body: `{ sourceSystem, mode: "dry_run" | "import", resources: [...] }`
- Initial transport is batch upload/pull result ingestion, not long-running background polling.

Recommended scopes:
- API key scope `integrations:fhir:write` for inbound sync.
- Admin UI can run dry-run imports before enabling live import.

FHIR job statuses:
- `received`
- `parsed`
- `needs_review`
- `imported`
- `failed`

### Acceptance Criteria

- Dry-run returns patient and observation match decisions without mutation.
- Import mode writes patients/lab values using idempotent upserts and review rules for ambiguous matches.
- Unknown codes require mapping review.
- No outbound write-back is exposed in v1.
- Audit events identify FHIR source system, resource type, resource ID, target type, and target ID without logging full PHI payloads.

## 3. Future Card-Terminal Intake

The previous simulated card-reader intake was removed from the app because it was demo-only and not near-term product-critical. Keep the idea as a future integration candidate, but rebuild it only as a production-grade clinic IT/device workflow.

Potential scope:
- Read patient master data from German health-card or clinic card-terminal infrastructure when a clinic has the required connector/device environment.
- Use the same patient matching and duplicate-review surfaces as FHIR imports.
- Never treat browser-only mock card data as a production path.
- Persist only the minimum patient master data needed for intake; do not log raw device payloads.
- Gate the feature behind explicit organization configuration, role checks, audit events, and procurement/security review.

Acceptance criteria before implementation:
- A real integration contract exists for the target connector/device path.
- Security review covers device trust boundary, authentication, audit logging, PHI minimization, and failure handling.
- Intake creates or updates patients only through reviewed match decisions, not silent overwrites.
- Tests cover successful read, no-card/no-device errors, duplicate patient detection, access denial, and audit events.

## 4. Next Implementation Order

1. Build the FHIR Patient/Observation dry-run with job/result and mapping surfaces.
2. Enable broader FHIR sync only after the dry-run review workflow is stable.
3. Revisit card-terminal intake only after FHIR and clinic security review foundations are stable.
