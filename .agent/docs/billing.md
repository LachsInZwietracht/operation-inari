# Billing And Subscription Notes

Billing is not production-ready yet.

Current guidance for agents:
- Do not assume Stripe, Polar, or another payment provider is active unless current code and `package.json` prove it.
- The tariff/admin billing surface is a preview-only product/admin UI. Its static catalog lives in `lib/content/billing-preview.ts`, and it is not a checkout or subscription backend.
- Before implementing billing, inspect `app/(app)/admin/tarife`, invoice code under `app/(app)/abrechnung`, related hooks/data modules, and `package.json`.
- Choose a payment provider only after the user confirms the commercial model and provider preference.
- Any real billing implementation must include server-only secrets, webhook signature verification, idempotency, audit logging, and tests for subscription state transitions.

Expected future work:
- Decide provider and pricing model.
- Add provider SDK and server-only configuration.
- Persist organization subscription state.
- Gate plan-specific features through server-side authorization.
- Add webhook handlers and operational logs.
- Document required environment variables in `.env.example` when introduced.
