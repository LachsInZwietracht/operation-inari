# Public Repository Release

Do not change the visibility of the existing private repository. Removed
personal and customer material remains present in its Git history.

The fastest safe release is a new repository created from the cleaned current
snapshot:

```bash
# First commit the reviewed hardening changes to the private repository.
release_dir="$(mktemp -d)"
git archive --format=tar HEAD | tar -x -C "$release_dir"

cd "$release_dir"
git init
git add .
git commit -m "Initial public release"
gh repo create operation-prodi-public --public --source=. --remote=origin --push
```

Before pushing:

1. Confirm `.env.local`, raw data files, test authentication state, and build
   output are absent.
2. Run the secret scan against the release directory.
3. Review `LICENSE`, `SECURITY.md`, and `THIRD_PARTY_NOTICES.md`.
4. Enable GitHub secret scanning, push protection, Dependabot alerts, and
   private vulnerability reporting.
5. Keep the production Supabase project and deployment environment separate
   from contributor or preview environments.

For production deployment, rate-limit `POST /api/protokoll/submit` at the
hosting firewall or edge layer. The application enforces bounded payloads and
single-use links, but network-level request throttling belongs at the edge.
