# Testing in `apps/web`

This app now supports four testing layers:

- Unit tests (`*.unit.test.ts`)
- tRPC tests (`*.trpc.test.ts`)
- API tests (`*.api.test.ts`)
- Infra-backed integration tests (`*.integration.test.ts`)

## Stack

- Runner: Vitest
- Coverage: V8 provider via `@vitest/coverage-v8`
- Path aliases: `vite-tsconfig-paths`
- Infra for integration: PostgreSQL via Docker Compose

## Commands

From repo root:

- `pnpm test:web`
- `pnpm test:web:all`
- `pnpm test:web:unit`
- `pnpm test:web:trpc`
- `pnpm test:web:api`
- `pnpm test:web:integration`
- `pnpm test:web:integration:full`

Infra helpers:

- `pnpm test:infra:up`
- `pnpm test:infra:down`

Full integration flow:

1. `pnpm test:infra:up`
2. `pnpm test:web:integration:full` (or `pnpm test:web:all`)
3. `pnpm test:infra:down`

## Infra configuration

- Compose file: `docker/testing/compose.yml`
- Postgres: `127.0.0.1:54329` (`usesend_test`)

The default test env is bootstrapped in `src/test/setup/setup-env.ts`.
Override values by exporting env vars before running tests.

## Test layout

- `src/test/setup/*`: global test bootstrap
- `src/test/integration/*`: integration reset helpers
- Tests colocated next to modules under `src/**`

## Notes

- Integration suites only run when `RUN_INTEGRATION=true`.
- Integration helpers truncate all public Postgres tables (except `_prisma_migrations`) before each test.
- Queue tests use the same isolated PostgreSQL test database.

## CI

GitHub Actions workflow: `.github/workflows/test-web.yml`

The workflow runs unit, tRPC, API, and integration tests with PostgreSQL.
