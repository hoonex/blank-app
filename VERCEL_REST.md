# Direct Vercel REST deployment

This repository contains `scripts/vercel-rest.mjs`, a deployment path that does not depend on the ChatGPT Vercel connector's project lookup behavior.

## Required secret

- `VERCEL_TOKEN` — Vercel access token with access to the target account/team.

## Optional secrets

- `VERCEL_TEAM_ID` — team scope. Leave empty for the token's personal/default scope.
- `VERCEL_PROJECT_ID` — existing project ID. Leave empty to use/create `flow-student`.

The script creates or resolves the project, sets `ssoProtection` to `null` by default, deploys the repository's static web assets through `POST /v13/deployments`, waits for `READY`, and prints the production deployment URL.

GitHub Actions workflow: `.github/workflows/vercel-rest-deploy.yml`.

Until `VERCEL_TOKEN` is configured, the workflow validates the module and intentionally skips deployment instead of failing.
