# Verification

## Completed

- Converted the repository into an Nx monorepo with `apps/api` and `apps/web`.
- Added Nx project definitions and root workspace configuration.
- Removed nested application package manifests so dependencies are managed at the workspace root.
- Preserved the NestJS modules and React dashboard implementation.
- Corrected the default SQLite path to `data/starlink.db` when commands are run from the Nx workspace root.
- Performed a structural integrity check: all required workspace/application files are present and there are no stale nested `package.json` files.
- Audited the Starlink v2 contract against the current Starlink documentation and corrected the data-usage envelope handling, v2 telemetry query integration, current telemetry field names, pagination, and service-account response validation.
- Added RBAC enforcement for site mutations, strict DTO validation, production secret/configuration guards, sanitized API-account responses, linked-account deletion protection, demo-data seeding, and idempotent daily sync updates.
- Corrected analytics to honor their 30-day/12-month windows and kept live-sync failures visible instead of erasing their error state.

## Runtime / visual verification

Verified locally with the installed workspace dependencies:

- `npm run test` — 2 test files / 11 tests passed.
- `npm run build` — API and web builds passed (Vite reports only the existing large-bundle warning).
- `npm run serve:api` — Nest starts successfully without the previously missing watch-only `chokidar` dependency.
- Temporary SQLite runtime smoke test — login, seeded 15-site dashboard (12 online / 3 offline), 30-day analytics, viewer write rejection (403), protected-field validation (400), sanitized account response, and repeated sync idempotency (30 records before/after).

To run the application locally:

```bash
npm install
npm run build
npm run dev
```

Then verify the normal browser workflow:

1. `http://localhost:5173` renders the login screen.
2. `admin / admin123` logs in.
3. Dashboard loads the seeded 15 sites from SQLite in development.
4. Dashboard, Starlink Sites, Usage & Analytics, API Accounts, and Settings navigation works.
5. Adding a site persists it through NestJS into SQLite.
6. API account configuration persists through the backend.
7. Refreshing the browser preserves backend data and requires JWT authentication.

Live Starlink verification still requires a real v2 service account with the required account, service-plan, device-management, and device-telemetry permissions. The integration is covered with mocked contract tests; no real credentials are stored or used during verification.
