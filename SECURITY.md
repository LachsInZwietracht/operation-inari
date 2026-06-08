# Security Policy

## Reporting

Do not open public issues for suspected vulnerabilities or exposed data.
Report them privately through GitHub Security Advisories for this repository.

Include affected routes or components, reproduction steps, and potential
impact. Do not include real patient data, credentials, or access tokens.

## Deployment Requirements

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Never enable `NEXT_PUBLIC_DISABLE_AUTH_FOR_TESTING` outside local testing.
- Apply all Supabase migrations and verify RLS before deployment.
- Keep patient report storage private and use authorized signed downloads.
- Rate-limit `/api/protokoll/submit` at the hosting firewall or edge layer.
- Enable dependency and secret scanning in GitHub.
- Rotate any credential immediately if it is committed or logged.
- Treat spreadsheet ETL input as trusted administrator-provided data. The
  development-only `xlsx` parser must not be exposed as a public upload parser.
