# Agent Roadmap Notes

Last updated: 2026-04-24

Use this as an agent-readable backlog summary. For product intent, read `docs/product-requirements.md`. For competitor strategy, read `docs/competitive-audit.md`.

## Clinic-First Priorities

1. **Data credibility:** SFK/full BLS expansion, source/version visibility, calculation validation, and database update workflows.
2. **Clinic IT readiness:** SSO, audit logs, HL7/FHIR, API keys, webhooks, and production connector foundations.
3. **Patient-to-kitchen bridge:** Diet orders, allergen-safe meal selection, tray cards, kitchen reports, and institution analytics.
4. **Clinical documentation:** Immutable report history, report packs, patient handouts, clinic handoff documents, and export retention policy.
5. **Patient portal:** Remote diary, report delivery, follow-up reminders, patient feedback, and secure communication.
6. **Commercial readiness:** Clinic pricing, contract/admin flows, migration tools, security documentation, and guided demo/onboarding flows.

## Current Implementation Themes

- Auth/RBAC foundation exists; full invitation, role mutation, team sharing, and broader audit coverage remain open.
- eGK is demo/simulated; production connector work remains open.
- Food database foundation exists with BLS/Open Food Facts flows; broader official/licensed data sources remain roadmap.
- Institution workflows exist for menu cycles, inpatient meal orders, compliance, and tray cards; deeper kitchen ERP features remain roadmap.
- Export/report foundations exist; scheduled exports, retention policy, and richer clinic document packs remain roadmap.
- Billing/tariff surface is explicitly preview-only; real subscription/checkout backend is not wired.

## Agent Guidance

- Do not treat this file as implementation proof.
- Verify feature status in code and `documentation.md` before editing.
- Update this file only when priorities or backlog facts materially change.
