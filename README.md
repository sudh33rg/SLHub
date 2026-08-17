# Starlink Command Center — Nx Monorepo

Production-oriented full-stack foundation for the Starlink Command Center UI supplied as the reference design.

## Stack

- Nx monorepo
- NestJS API
- React + Vite frontend
- TypeORM + embedded SQLite
- JWT authentication
- bcrypt password hashing
- AES-256-GCM encryption for stored API client secrets
- Recharts analytics

## Workspace

```text
apps/
├── api/    # NestJS backend
└── web/    # React/Vite frontend
```

SQLite is intentionally local and embedded. The default database path is:

```text
data/starlink.db
```

## Development

```bash
npm install
npm run dev
```

Or independently:

```bash
npm run serve:api
npm run serve:web
```

- Web: http://localhost:5173
- API: http://localhost:3000/api

## Build

```bash
npm run build
```

## Default login

```text
admin / admin123
```

Development seeds include the demo users and 15 demo sites. Set `SEED_DEMO_DATA=false` (and use `NODE_ENV=production`) before deploying outside development. Production also requires `JWT_SECRET`, `APP_ENCRYPTION_KEY`, and an explicit `DB_PATH`.

## Nx commands

```bash
npx nx show projects
npx nx graph
npx nx build api
npx nx build web
npx nx serve api
npx nx serve web
```

## Runtime flow

```text
React/Vite
   ↓
Axios API client
   ↓
NestJS REST API
   ↓
Application services
   ↓
TypeORM
   ↓
SQLite (embedded/local)
```

The Starlink V2 integration layer is intentionally separated behind the API-account model. Client secrets stay encrypted in the API database, live usage is pulled through the v2 data-usage query, and live terminal health comes from the v2 telemetry query when a terminal is linked. The frontend receives only sanitized API-account metadata.

Useful runtime configuration:

```text
PORT=3000
DB_PATH=data/starlink.db
DB_SYNCHRONIZE=true        # development only; use migrations/false in production
JWT_SECRET=...
APP_ENCRYPTION_KEY=...     # 32 UTF-8 bytes or 64 hex characters
CORS_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:3000/api
```
