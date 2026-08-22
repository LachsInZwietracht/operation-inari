# FHIR Integration Plan

Status: OIDC/SAML SSO, claim-to-role mapping, callback membership application, API keys, and their audit foundations are implemented. This document now contains only the remaining FHIR work.

## Goal and First Boundary

FHIR is the primary inbound interoperability boundary. It should reuse the existing patient matching, lab mapping, audit, and import-review surfaces.

The first version is read-only inbound sync for:

- `Patient`
- `Observation` for lab values only

Initially deferred:

- `Encounter`
- `Condition`
- `MedicationStatement`
- `ServiceRequest`
- `DocumentReference`
- write-back to HIS/EHR

## Resource Mapping

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

## Sync Contract

Recommended endpoint:

- `POST /api/integrations/fhir/sync`
- Body: `{ sourceSystem, mode: "dry_run" | "import", resources: [...] }`
- Initial transport is batch upload/pull result ingestion, not long-running background polling.

Recommended access:

- API key scope `integrations:fhir:write` for inbound sync.
- Admin UI can run dry-run imports before enabling live import.

FHIR job statuses:

- `received`
- `parsed`
- `needs_review`
- `imported`
- `failed`

## Acceptance Criteria

- Dry-run returns patient and observation match decisions without mutation.
- Import mode writes patients/lab values using idempotent upserts and review rules for ambiguous matches.
- Unknown codes require mapping review.
- No outbound write-back is exposed in v1.
- Audit events identify source system, resource type, resource ID, target type, and target ID without logging full PHI payloads.
- Raw FHIR messages/resources never appear in logs or API error bodies.

## Next Step

Build the `Patient`/`Observation` dry-run with persisted job/results, code mapping, duplicate review, and audit events. Enable import only after that review workflow is stable.
