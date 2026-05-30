# Agent Documentation Index

This folder contains agent playbooks and narrow technical notes. The canonical project-wide agent contract is `AGENTS.md`.

## Read Order

1. Start with `AGENTS.md`.
2. Use `docs/README.md` to choose product/implementation docs.
3. Use files in `.agent/docs` only when the task matches the topic.

## Available Playbooks

| File | Use For | Notes |
|---|---|---|
| `supabase.md` | Supabase, migrations, RLS, ETL credentials, auth behavior | Verify commands against `package.json`; use `npx supabase` unless scripts exist. |
| `billing.md` | Tariffs, subscriptions, checkout, provider selection | Billing is preview-only; no provider is active unless code proves otherwise. |

## Maintenance Rules

- Keep these playbooks concise and operational.
- Remove vendor docs when the vendor is not installed or confirmed by product direction.
- Do not duplicate long feature, schema, or roadmap sections here; link to `docs/` instead.
