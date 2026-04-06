# TASK-01 — Project Scaffold & Infrastructure

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[x]` Done |
| **Estimated effort** | ~1 hour |
| **Blocks** | TASK-02, TASK-03 |
| **Blocked by** | — (first task) |
| **Commit message** | `chore: scaffold NestJS project with Docker, config, logging, and Swagger` |

---

## What Was Done

All scaffold deliverables are complete. Actual implementation differs slightly from the original plan in env var naming (uses `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` instead of `DATABASE_*`) — this is consistent throughout the codebase and intentional.

### Actual env var naming used

| Original plan | Actual |
|---------------|--------|
| `DATABASE_PASSWORD` | `DB_PASSWORD` |
| `DATABASE_HOST` | `DB_HOST` |
| `DATABASE_PORT` | `DB_PORT` |
| `DATABASE_USER` | `DB_USER` |
| `DATABASE_NAME` | `DB_NAME` |

This means the Joi validation schema in `app.module.ts` validates `DB_*` vars (all optional), and docker-compose injects `DB_*` vars. Consistent and correct.

### Database/user names

Docker compose uses `workout`/`workout_db`/`workout_test_db` (not `everfit` from original plan). The data-source defaults match.

### Notes

- `dayjs` was added as a runtime dependency (needed by TASK-07 progress util)
- `jest.config.ts` was NOT created — jest config lives in `package.json` (simpler, works fine)
- `.env.example` not yet committed — minor gap, add before TASK-11

---

## Completed Deliverables

- [x] `src/app.module.ts` (ConfigModule pure-env, TypeOrmModule, LoggerModule)
- [x] `src/main.ts` (Helmet, CORS, ValidationPipe, GlobalExceptionFilter, Swagger)
- [x] `src/shared/constants/error-codes.ts` (moved from `src/common/`)
- [x] `src/shared/filters/http-exception.filter.ts` (moved from `src/common/`)
- [x] `src/database/data-source.ts`
- ~~`config/config.yaml`~~ — removed (pure env approach)
- ~~`config/config.production.yaml`~~ — removed
- ~~`config/config.test.yaml`~~ — removed
- ~~`src/config/configuration.ts`~~ — removed
- [x] `src/modules/workout/workout.module.ts` (stub)
- [x] `docker-compose.yml` (api + db + db-test)
- [x] `Dockerfile` (multi-stage)
- [x] `test/jest-integration.json`
- [x] `package.json` scripts (test:integration, migration:*)
- [ ] `.env.example` — add before TASK-11

---

## Acceptance Criteria

- [x] `pnpm start:dev` starts without errors
- [x] `docker compose up --build` starts API + DB successfully
- [x] `pnpm test:unit` runs (0 test failures)
- [x] `pnpm test:integration` runs
- [x] No `synchronize: true` anywhere in codebase
