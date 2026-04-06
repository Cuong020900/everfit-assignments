# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## NOTE

Each time you change code, review the conventions below and update this file if you find anything that should be standardised for future sessions.

## CONVENTION

### Style & Formatting (Biome)
- **Single quotes** everywhere — `'value'` not `"value"`
- **Semicolons always** — never omit trailing semicolons
- **Trailing commas** in multi-line structures (arrays, objects, params)
- **Line width: 100** characters
- **Indent: 2 spaces** (no tabs)
- **Imports sorted automatically** by Biome organise-imports on save/check
- **`node:` prefix** on Node built-ins — `import { join } from 'node:path'` not `'path'`
- **Template literals** over string concatenation — `` `${__dirname}/foo` `` not `__dirname + '/foo'`

### TypeScript
- **`any` is `warn` in source, off in tests** — use `biome-ignore lint/suspicious/noExplicitAny: <reason>` with a one-line justification when `any` is genuinely needed (e.g. NestJS untyped response bodies)
- **Named type aliases** instead of inline `Record<string, any>` — e.g. `type ConfigMap = Record<string, any>`
- **`const`** over `let` wherever the binding is not reassigned
- **No `var`**
- **No relative imports** — always use `@src/` path alias. `import { Foo } from '@src/modules/...'` never `'../../...'`

### Comments
- Only add comments for complex logic — do not comment obvious code
- Inline suppression format: `// biome-ignore lint/rule/name: <one-line reason>`

### Migrations
- Use `queryRunner.createTable(new Table({...}))` for table structure — never raw SQL for DDL
- Use `queryRunner.createIndex(tableName, new TableIndex({...}))` for plain indexes
- **Exception:** `TableIndex` has no per-column `DESC` support. When a `DESC` sort direction is required, use `queryRunner.query('CREATE INDEX ... ON ... (col DESC)')` and add a comment: `// TableIndex does not support per-column DESC — raw SQL required for sort direction`
- `down()` only needs `dropTable(name, true)` — dropping a table drops its indexes automatically
- Never add FK constraints in migrations — referential integrity is managed at the application layer
- Seed data lives in `src/database/seeds/` and runs via `pnpm seed` — never embed seed in migrations

### Entities
- All entity columns must use `!` non-null assertions (strict TS mode)
- All entities must include `@CreateDateColumn created_at` and `@UpdateDateColumn updated_at`
- No soft delete (`deleted_at`) until a delete endpoint is planned
- `NUMERIC` / `DECIMAL` PostgreSQL columns must use a `numericTransformer` (`parseFloat` on read) — the `pg` driver returns them as strings
- `DATE` columns are intentionally typed `string` — pg returns `'YYYY-MM-DD'` and converting to `Date` introduces timezone shifts
- Static routes (`/pr`, `/progress`, `/insights`) must be declared **before** any `/:param` route in the controller
- Domain errors are thrown as `throw new Error('ERROR_CODE')` — never throw HTTP exceptions from use-cases
- Use-cases receive `IWorkoutRepository` via `WORKOUT_REPOSITORY` injection token, never `TypeOrmWorkoutRepository` directly
- `weight_kg` is computed **at write time** in `LogWorkoutUseCase` — never convert units in query methods

## Commands

```bash
# Development
pnpm start:dev          # hot-reload dev server (port 3000)
pnpm build              # TypeScript compile → dist/

# Linting & formatting (Biome — replaces ESLint + Prettier)
pnpm lint               # lint with auto-fix
pnpm format             # format with auto-fix
pnpm check              # lint + format + import sort together (preferred)

# Testing
pnpm test               # unit tests only (no DB required)
pnpm test:unit          # alias for pnpm test
pnpm test:watch         # unit tests in watch mode
pnpm test:cov           # unit tests with coverage report
pnpm test:integration   # integration tests (requires DB on port 5433)

# Run a single test file
pnpm test -- --testPathPattern=unit-converter
pnpm test:integration -- --testPathPattern=log-workout

# Docker
docker compose up --build       # start API + postgres + postgres-test
docker compose down -v          # full teardown with volumes
```

## Test Architecture

Two distinct test types — **never mix them**:

| Type            | Location                        | Command                 | DB needed       |
| --------------- | ------------------------------- | ----------------------- | --------------- |
| **Unit**        | `test/unit/**/*.spec.ts`        | `pnpm test`             | No              |
| **Integration** | `test/integration/**/*.spec.ts` | `pnpm test:integration` | Yes (port 5433) |

The default `jest` config (in `package.json`) covers only `src/**/*.spec.ts` (unit). Integration tests use `test/jest-integration.json` with `NODE_ENV=test`.

Unit tests use mocked repositories (`createMockRepository()` factory). Integration tests boot NestJS in-process via `Test.createTestingModule()` + Supertest against a real test DB.

## Architecture

```
src/
├── app.module.ts               # Root module — wires ConfigModule, TypeOrmModule, LoggerModule
├── main.ts                     # Bootstrap: Helmet, CORS, ValidationPipe, GlobalExceptionFilter, Swagger
├── shared/
│   ├── constants/error-codes.ts  # KNOWN_ERROR_CODES set + ERROR_MESSAGES map
│   ├── filters/http-exception.filter.ts  # GlobalExceptionFilter → { statusCode, error, message }
│   └── utils/                  # date-period.util.ts, cursor.util.ts, unit-converter.ts
├── database/
│   ├── data-source.ts          # TypeORM DataSource for CLI migrations
│   └── migrations/             # Generated migration files
└── modules/
    └── workout/
        ├── workout.module.ts
        ├── workout.controller.ts
        ├── dto/                # Request DTOs with class-validator decorators
        ├── entities/           # TypeORM entities: WorkoutEntry, WorkoutSet, ExerciseMetadata
        ├── interfaces/         # IWorkoutRepository, InsightPlugin interfaces
        ├── use-cases/          # One class per use-case (LogWorkout, GetHistory, GetPR, GetProgress, GetInsights)
        └── plugins/            # InsightPlugin implementations (multi: true DI)

test/
├── unit/
│   ├── use-cases/              # Use-case specs with mocked IWorkoutRepository
│   ├── utils/                  # Utility function specs
│   └── insights/               # InsightPlugin specs
└── integration/                # HTTP-level specs with Supertest + real test DB
```

## Key Design Decisions

### API Endpoints
All 5 endpoints live under `/workouts`. The controller must declare static routes (`/pr`, `/progress`, `/insights`) **before** any `/:id` route to avoid NestJS treating the segment as a path param.

### Error Shape
Every error response is `{ statusCode: number, error: string, message: string }` — enforced by `GlobalExceptionFilter`. Domain errors are thrown as `new Error('ERROR_CODE')` (e.g., `throw new Error('EMPTY_ENTRIES')`); the filter maps them to 400 responses using `KNOWN_ERROR_CODES`.

### Repository Pattern
`IWorkoutRepository` is the abstraction injected into all use-cases via the `WORKOUT_REPOSITORY` symbol. The TypeORM implementation is registered as `{ provide: WORKOUT_REPOSITORY, useClass: TypeOrmWorkoutRepository }`. Unit tests inject a mock object instead.

### Insight Plugin System
`InsightPlugin` implementations are registered as `{ provide: INSIGHT_PLUGINS, useClass: ..., multi: true }`. `GetInsightsUseCase` receives `InsightPlugin[]`. Adding a new insight = one new class + one line in `workout.module.ts` (OCP).

### Weight Storage
`weight_kg` is computed and stored at write time (unit conversion happens once in `LogWorkoutUseCase`). Query-time conversion is never needed for aggregations.

### Cursor Pagination
History uses base64url-encoded `{ date, id }` JSON cursor. Composite index on `(user_id, date DESC, id DESC)` makes this efficient.

## Configuration

Pure env vars — no YAML config files. `ConfigModule.forRoot` reads `.env` with Joi validation and sensible defaults.

| Env var | Default | Notes |
|---------|---------|-------|
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | Test DB uses `5433` |
| `DB_NAME` | `workout_db` | Test DB uses `workout_test_db` |
| `DB_USER` | `workout` | |
| `DB_PASSWORD` | `workout` | |
| `PORT` | `3000` | |
| `LOG_LEVEL` | `info` | |
| `CORS_ORIGINS` | (all) | Comma-separated list |

`ConfigService` is available globally (no need to import `ConfigModule` in feature modules).

## TDD Workflow

Follow Red → Green → Refactor strictly:

1. Write the failing test first (`test/unit/` or `test/integration/`)
2. Run `pnpm test` — confirm it fails for the right reason
3. Write the minimal implementation to make it pass
4. Refactor with tests green

## Implementation Task Order

Tasks are in `plans/` with explicit `blocks`/`blockedBy` metadata. Always follow the dependency graph in `plans/README.md`. The critical path is:

```
TASK-01 → TASK-02 → TASK-03 → TASK-04 → (05/06/07/08 in parallel) → TASK-09 → TASK-10 → TASK-11
```

Current status: TASK-01 ✅ complete. TASK-02 🔄 in progress (tests written RED, source files missing).
