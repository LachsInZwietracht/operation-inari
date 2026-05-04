# Clinic IT Integration Plan

This document defines the remaining P1 clinic IT contracts after the SSO, API key, and webhook foundations.

Status: requirements and MVP boundaries are defined. Implementation should start from the schemas and acceptance criteria below, not from ad-hoc connector code.

## 1. LDAP / Active Directory Mapping

### Goal

Allow a clinic IT team to map identity-provider claims and directory groups to Operation Prodi roles without manual per-user role maintenance.

This builds on the persisted SSO foundation in `organization_sso_configs`. It does not replace Supabase Auth or local RBAC; it defines how an authenticated SSO principal should be placed into `organization_memberships`.

### Scope

Supported identity source:
- OIDC claims from Entra ID, Keycloak, or another hospital IdP.
- SAML attributes from hospital AD FS, Shibboleth, or SAML bridge products.
- LDAP/Active Directory groups as surfaced through OIDC/SAML claims. Direct LDAP bind/sync is not part of v1.

Required mapping inputs:
- `organization_sso_config_id`
- `claim_name`, for example `groups`, `roles`, `memberOf`, `department`, `extension_Role`
- `claim_value`, for example an Entra group object ID or AD distinguished name
- target app role: `owner`, `admin`, `dietitian`, `assistant`, `institution_admin`
- status: `active` or `disabled`
- priority for deterministic conflict resolution
- optional notes for clinic IT review

Recommended table:

```sql
CREATE TABLE sso_group_role_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sso_config_id UUID NOT NULL REFERENCES organization_sso_configs(id) ON DELETE CASCADE,
  claim_name TEXT NOT NULL,
  claim_value TEXT NOT NULL,
  target_role TEXT NOT NULL CHECK (target_role IN ('owner', 'admin', 'dietitian', 'assistant', 'institution_admin')),
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  notes TEXT,
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
- Mapping validation rejects unknown app roles, empty claim names, empty claim values, and duplicate active mappings.
- Login callback can resolve a role from verified claims without granting a role from the email domain alone.
- Audit log captures actor, mapping ID, previous role/status, next role/status, claim name/value, and SSO config ID.
- Tests cover deterministic priority, ambiguity rejection, Owner downgrade protection, and no-match behavior.

## 2. HL7 v2 Import MVP

### Goal

Import a minimal, auditable subset of HL7 v2 messages for clinics that cannot offer FHIR first.

The MVP should parse patient identity and lab observations into existing tables:
- `patients`
- `patient_lab_values`
- `access_audit_logs`

### Message Types

Initial support:
- `ADT^A01`, `ADT^A04`, `ADT^A08` for patient create/update.
- `ORU^R01` for lab observations.

Initial segments:
- `MSH` for message metadata.
- `PID` for patient identity.
- `OBR` for observation group context.
- `OBX` for lab observations.

Explicitly out of scope for MVP:
- Orders (`ORM`, `ORC`) beyond optional OBR context.
- Allergies (`AL1`), diagnoses (`DG1`), encounters (`PV1`) as persisted imports.
- Bidirectional ACK transport. MVP may store parse results and return API JSON.
- Binary HL7 attachments.

### PID Mapping

| HL7 field | Meaning | Target |
|---|---|---|
| `PID-3` | Patient identifiers | `patients.legacy_id` using source prefix, plus import metadata |
| `PID-5` | Patient name | `patients.last_name`, `patients.first_name` |
| `PID-7` | Birth date | `patients.date_of_birth` |
| `PID-8` | Sex | `patients.gender` (`M` -> `m`, `F` -> `w`, other/unknown -> `d`) |
| `PID-11` | Address | `street`, `city`, `zip` when present |
| `PID-13` | Phone | `patients.phone` |
| `PID-19` | National identifier | metadata only; do not store raw national IDs unless a legal basis is confirmed |

Patient matching order:
1. Existing `patients.legacy_id` for the configured HL7 assigning authority.
2. Exact match on name + date of birth + user/organization scope.
3. Create new patient only if the import mode allows creation.
4. Ambiguous matches must stop the import and produce a review result.

### OBX Mapping

| HL7 field | Meaning | Target |
|---|---|---|
| `OBX-3` | Observation identifier | `patient_lab_values.parameter_id` via mapping table |
| `OBX-5` | Observation value | `patient_lab_values.value` when numeric |
| `OBX-6` | Units | `patient_lab_values.metadata.unit` |
| `OBX-7` | Reference range | `patient_lab_values.metadata.referenceRange` |
| `OBX-8` | Abnormal flags | `patient_lab_values.metadata.abnormalFlags` |
| `OBX-11` | Result status | `patient_lab_values.metadata.resultStatus` |
| `OBX-14` | Observation time | `patient_lab_values.date` |

Recommended mapping table:

```sql
CREATE TABLE hl7_lab_parameter_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  hl7_identifier TEXT NOT NULL,
  hl7_text TEXT,
  hl7_coding_system TEXT,
  parameter_id TEXT NOT NULL,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source_system, hl7_identifier, hl7_coding_system)
);
```

### Import Job Contract

Recommended tables:
- `hl7_import_jobs`: one row per uploaded message or batch.
- `hl7_import_results`: one row per parsed patient/observation outcome.

Minimum job fields:
- `organization_id`
- `actor_user_id`
- `source_system`
- `message_control_id` from `MSH-10`
- `message_type` from `MSH-9`
- `status`: `received`, `parsed`, `needs_review`, `imported`, `failed`
- `raw_message_sha256`; raw payload storage should be private and retention-controlled
- `summary` JSONB with counts and non-PHI parse diagnostics

Minimum result fields:
- `job_id`
- `target_type`: `patient` or `patient_lab_value`
- `target_id`
- `status`: `created`, `updated`, `skipped`, `needs_review`, `failed`
- `metadata` JSONB with source segment references, not full raw segments when avoidable

### API Boundary

MVP endpoint:
- `POST /api/integrations/hl7/import`
- Requires app-session admin/institution admin or an API key with future scope `integrations:hl7:write`.
- Accepts `text/plain` HL7 or JSON `{ sourceSystem, message }`.
- Returns a job summary with counts and review items.

Security:
- Do not accept anonymous HL7 imports.
- Do not store raw messages in logs.
- Do not echo full PID/OBX content in error responses.
- Every accepted message writes an audit event `hl7_import_received`.
- Every patient/lab mutation writes `hl7_patient_upserted` or `hl7_lab_value_upserted`.

### Acceptance Criteria

- Parser handles HL7 delimiters from `MSH-1` and `MSH-2`.
- Parser extracts `MSH`, `PID`, `OBR`, and multiple `OBX` segments from a sample ORU message.
- Unknown lab identifiers produce `needs_review`, not a silently invented `parameter_id`.
- Numeric OBX values import to `patient_lab_values`; non-numeric values are skipped with review reason.
- Duplicate `MSH-10` from the same source system is idempotent.
- Tests include one ADT patient update, one ORU lab import, one unknown lab mapping, and one ambiguous patient match.

## 3. First FHIR Sync Boundary

### Sequencing

FHIR should start after the HL7 MVP is stable because the same patient matching, lab mapping, audit, and import-review surfaces are needed for both.

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
- `Patient.identifier` -> same external identifier model used by HL7 imports
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

FHIR job statuses should mirror HL7:
- `received`
- `parsed`
- `needs_review`
- `imported`
- `failed`

### Acceptance Criteria

- Dry-run returns patient and observation match decisions without mutation.
- Import mode writes patients/lab values using the same idempotency and review rules as HL7.
- Unknown codes require mapping review.
- No outbound write-back is exposed in v1.
- Audit events identify FHIR source system, resource type, resource ID, target type, and target ID without logging full PHI payloads.

## 4. Next Implementation Order

1. Implement `sso_group_role_mappings` and admin UI under SSO configuration.
2. Add pure HL7 parser utilities with deterministic fixtures.
3. Add HL7 import job/result tables and dry-run import API.
4. Add lab parameter mapping admin surface.
5. Enable HL7 import mode after review UI exists.
6. Reuse the same job/result and mapping surfaces for FHIR Patient/Observation dry-run.
