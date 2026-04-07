# Design Document

This document covers the key decisions across each evaluation criterion.

---

## 1. System Design

### Schema

Three tables. No join tables, no soft-delete columns until a delete endpoint is planned (YAGNI).

```
workout_entries  (id PK uuid, user_id uuid, date date, exercise_name varchar, created_at, updated_at)
workout_sets     (id PK uuid, entry_id FK, reps int, weight numeric, unit varchar, weight_kg numeric)
exercise_metadata (name PK varchar, muscle_group varchar, aliases text[])
```

**Normalization decisions:**

- `workout_sets` is a child table of `workout_entries` (1-to-many). Sets are never queried independently of their entry, so a FK with cascading delete is appropriate.
- `exercise_metadata` holds the exercise→muscle-group mapping. It is a separate table so the mapping is configurable at runtime (UPDATE/INSERT) without code changes.
- No `user` table — userId is a UUID passed on every request. Authentication is out of scope.
- `weight_kg` is a **denormalized computed column** on `workout_sets`. It stores the kg-normalized value at write time so aggregation queries (PR, progress, volume) never do unit conversion at read time.

### Indexing Strategy

```sql
-- workout_entries
CREATE UNIQUE INDEX uq_entries_user_exercise_date
  ON workout_entries (user_id, exercise_name, date);
-- Serves three purposes:
-- 1. Enforces one entry per exercise per calendar day per user (concurrent-write safety)
-- 2. Covers PR and progress queries that filter by (user_id, exercise_name) and sort by date
-- 3. Supersedes any non-unique index on the same columns

CREATE INDEX idx_entries_user_date_id
  ON workout_entries (user_id, date DESC, id DESC);
-- Covers history cursor pagination: filters on user_id, sorts on (date DESC, id DESC).
-- Including id in the index avoids a filesort on deep pages.
```

No index on `workout_sets` beyond the FK — sets are always fetched via their entry's id.

### Weight Storage

Unit conversion happens **once, at write time** in `WorkoutEntryService.logWorkout()`:

```typescript
weightKg: toKg(set.weight, set.unit)
```

All aggregations (`weight_kg` sums, max, Epley) operate on the stored `weight_kg` column.
Conversion back to the user's preferred unit happens at **read time in the service layer**, not in SQL.
This keeps queries unit-agnostic and avoids per-row conversion math inside the DB engine.

### Timezone Handling

`date` columns are PostgreSQL `DATE` (not `TIMESTAMPTZ`). The `pg` driver returns them as `'YYYY-MM-DD'` strings. The application never converts them to `Date` objects, which would introduce timezone drift. All date comparisons use string comparison on ISO 8601 format, which sorts correctly lexicographically.

---

## 2. API Design

### Endpoints

```
POST   /workouts?userId=<uuid>           Log a workout session
GET    /workouts?userId=<uuid>&...       Paginated history
GET    /workouts/pr?userId=<uuid>&...    Personal records per exercise
GET    /workouts/progress?userId=<uuid>& Progress time series
GET    /workouts/insights?userId=<uuid>  Aggregated analytics insights
```

Static path segments (`/pr`, `/progress`, `/insights`) are registered **before** any `/:param` route in the controller so NestJS does not interpret them as path parameters.

### Response Shape

Every success response carries a `meta` envelope appended by `TransformResponseInterceptor`:

```json
{
  "data": { ... },          // or top-level fields for list endpoints
  "meta": {
    "timestamp": "2024-01-15T10:00:00.000Z",
    "requestId": "req-abc"
  }
}
```

Controllers return `{ data: result }`. The interceptor detects the `data` key and spreads `meta` alongside it, avoiding double-wrapping. Services return plain typed objects with no knowledge of the HTTP envelope.

### Pagination

History uses **cursor-based pagination** (not offset). Cursor encodes `{ date, id }` as `base64url` JSON:

```
GET /workouts?userId=...&limit=20&cursor=eyJkYXRlIjoiMjAyNC0wMS0xNSIsImlkIjoiYWJjIn0
```

- Stable under concurrent inserts (no skipped/duplicated rows as with LIMIT/OFFSET)
- Composite `(date DESC, id DESC)` cursor handles ties on the same date correctly
- Malformed cursors return `400 Bad Request`, not `500`

### Input Validation

All query parameters and body fields are validated with `class-validator` decorators on DTO classes. `ValidationPipe` is global with `whitelist: true` and `forbidNonWhitelisted: true` — unknown fields are rejected, not silently stripped.

Key validation rules:
- `userId` — `@IsUUID()` on every endpoint
- `date` — `@IsDateString()` (YYYY-MM-DD)
- `reps` — `@IsInt() @Min(1)`
- `weight` — `@IsNumber() @Min(0.001)`
- `unit` — `@IsEnum(WeightUnit)` (enforces `'kg'` or `'lb'` only)
- `limit` — `@IsInt() @Min(1) @Max(100)`
- `entries` — `@ArrayMinSize(1)`

---

## 3. Code Architecture

### Module Boundaries

```
app.module
├── workout-entry.module    → POST /workouts, GET /workouts (history)
├── workout-set.module      → GET /workouts/pr, GET /workouts/progress
└── exercise-metadata.module → GET /workouts/insights
```

Each module owns its controller, service(s), repository implementation, and DTOs. Cross-module sharing goes through `src/shared/` (enums, utils, types, constants) or through the database layer.

### Repository Pattern

Every repository is accessed through an interface injected via a token:

```typescript
// Consumer
@Inject(WORKOUT_ENTRY_REPOSITORY)
private readonly repo: IWorkoutEntryRepository

// Registration
{ provide: WORKOUT_ENTRY_REPOSITORY, useClass: TypeOrmWorkoutEntryRepository }
```

Services never import the concrete TypeORM class. This makes unit tests trivially mockable — tests inject a plain object that satisfies the interface.

Repository responsibility is **queries only**: filtering, sorting, pagination, basic joins. No business logic. Aggregations, 1RM calculations, and period comparisons all live in services.

### Separation of Concerns

| Layer | Responsibility |
|---|---|
| Controller | HTTP wiring, DTO binding, return `ApiResponse<T>` |
| Service | Business logic, aggregation, unit conversion at read time |
| Repository | SQL queries — fetching, saving, filtering |
| Plugin | Stateless compute on pre-fetched data |
| Shared utils | Pure functions: `toKg`, `fromKg`, `epley1RM` |

### Extensibility

**New unit type** — add one enum value + one conversion factor in `UNIT_TO_KG`. TypeScript's `Record<WeightUnit, number>` exhaustiveness check flags the missing entry at compile time. No service, repository, or controller changes needed.

**New insight** — implement `InsightPlugin`, register as a provider in `ExerciseMetadataModule`, add to the `useFactory` array. `ExerciseMetadataService` iterates `InsightPlugin[]` generically — zero changes to existing plugins or the service.

**Exercise→muscle mapping** — stored in the `exercise_metadata` table. Adding or remapping an exercise is an `INSERT`/`UPDATE` SQL statement. No code change, no redeploy.

---

## 4. Problem-Solving

### 1RM Calculation (Epley Formula)

```typescript
// src/shared/utils/epley.ts
export function epley1RM(weightKg: number, reps: number): number {
  return Math.round(weightKg * (1 + reps / 30) * 10000) / 10000;
}
```

Applied to every set when computing `bestOneRM` in `WorkoutSetService.computePRSet()`. The set that maximises `epley1RM(weightKg, reps)` across all sets in the period is selected — not the heaviest weight, which may have low reps.

### Period Comparison (PR Endpoint)

When `compareTo=previousPeriod` with explicit `from`/`to`:

```
current period:  [from  …  to]         (N days)
previous period: [from - N - 1  …  from - 1]
```

Delta is reported as absolute (`deltaKg`) and percentage (`deltaPct`). When previous value is 0 the percentage is 0 (not division-by-zero).

### Progress Aggregation

Daily bests are computed first (one data point per calendar day), then bucketed:

- `daily` — one point per day, period = `'YYYY-MM-DD'`
- `weekly` — ISO week label `'YYYY-Www'`, `bestWeight` = average of daily bests in the week
- `monthly` — label `'YYYY-MM'`

`insufficientData: true` when fewer than 2 data points are in the result — signals to the client that a trend line would be meaningless.

### Bulk Log

A single `POST /workouts` accepts multiple exercises in one request body (`entries[]`). All entries are saved in a single `repo.save(entities)` call (one round-trip). If any entry violates the unique constraint, the entire transaction fails with a `409 Conflict`.

### Muscle Group Balance

Volume per group = `Σ (reps × weight_kg)` across all sets for that group.
Distribution is expressed as a percentage of total volume, rounded to one decimal place.
A warning is emitted for any group below 20% of total volume.
The `muscleGroup` value is resolved by `findWorkoutData()` joining `workout_entries` against `exercise_metadata` at query time — plugins receive pre-enriched entries.

---

## 5. Error Handling

### Error Shape

Every error response follows a single shape, enforced by `GlobalExceptionFilter`:

```json
{
  "statusCode": 400,
  "error": "INVALID_UNIT",
  "message": "Unit must be \"kg\" or \"lb\""
}
```

### Error Flow

```
HttpException (NestJS/class-validator)
  → GlobalExceptionFilter → statusCode from exception, structured JSON

Domain error (throw new Error('ERROR_CODE'))
  → GlobalExceptionFilter → KNOWN_ERROR_CODES lookup → 400 + human message

PG unique_violation (code 23505)
  → WorkoutEntryService catch → throw ConflictException → 409

Malformed cursor
  → TypeOrmWorkoutEntryRepository try/catch → throw BadRequestException → 400

Unhandled error
  → GlobalExceptionFilter fallback → 500 + "An unexpected error occurred" (no stack leak)
```

### Validation Layers

1. **DTO boundary** — `class-validator` on every incoming DTO, `forbidNonWhitelisted: true`
2. **Service boundary** — domain errors (`INVALID_UNIT`, `EMPTY_ENTRIES`, etc.) thrown as `Error('CODE')`
3. **DB boundary** — PG error codes caught and translated to HTTP exceptions
4. **Cursor boundary** — `try/catch` in repository, `BadRequestException` on parse failure

All error codes and their human-readable messages are centralised in `src/shared/constants/error-codes.ts`. Adding a new domain error requires one entry in `KNOWN_ERROR_CODES` and one in `ERROR_MESSAGES`.

---

## 6. Testing

### Test Architecture

Two distinct test types that never mix:

| Type | Location | Command | DB |
|---|---|---|---|
| Unit | `test/unit/**/*.spec.ts` | `pnpm test` | No |
| Integration | `test/integration/**/*.spec.ts` | `pnpm test:integration` | Yes (port 5433) |

Unit tests cover all business logic with mocked repositories (`createMockRepository()` factory returns `jest.fn()` stubs). Integration tests boot NestJS in-process via `Test.createTestingModule()` and hit a real test database via Supertest.

### What Is Tested

**Unit — calculations:**
- `epley1RM` — boundary values (1 rep = weight, high reps)
- `toKg` / `fromKg` — round-trip accuracy, unsupported unit throws `INVALID_UNIT`
- `WorkoutSetService.getPRs` — max weight vs. best 1RM distinction, period comparison, cross-period exercises, `deltaPct=0` when previous=0
- `WorkoutSetService.getProgress` — daily/weekly/monthly grouping, `insufficientData` flag, default unit/groupBy
- `WorkoutEntryService.logWorkout` — kg/lb conversion at write time, bulk entries, PG 23505 → `ConflictException`, non-23505 error re-thrown
- Each `InsightPlugin` — empty data returns, correct aggregation, thresholds

**Integration — API contracts:**
- Each endpoint returns correct HTTP status and response shape
- Pagination: `nextCursor` present when `hasMore`, null at last page
- Cursor continuity: following `nextCursor` returns the next page without gaps
- Empty ranges, inverted date ranges, single data point (`insufficientData`)
- Validation: missing required fields, invalid UUID, invalid unit, limit >100
- Malformed cursor → 400
- Duplicate entry → 409
- Data isolation: User A's data not visible to User B
- Default period scope for insights (no `from`/`to` → last 30 days filters data)

### Test Design Principles

- Integration tests share a `beforeEach(() => truncateAll())` — each test starts with an empty DB, no ordering dependencies
- Seeding is explicit per test using `logWorkout()` / `seedExerciseMetadata()` helpers — tests document their own preconditions
- No mocks in integration tests — the real TypeORM stack runs against a real Postgres instance
- Calculations are tested at the unit level with closed-form expected values, not snapshot comparisons

---

## 7. Production Readiness

### Docker

Multi-stage build keeps the production image lean:

```
Stage 1 (builder): node:22-alpine + corepack enable → pnpm install --frozen-lockfile → tsc build
Stage 2 (runtime): node:22-alpine + corepack enable → production deps only → copy dist/
```

`corepack enable` reads the exact pnpm version from `package.json#packageManager` (`pnpm@9.1.0`) without a network call. `pnpm install --frozen-lockfile` in CI ensures reproducible builds — fails if `pnpm-lock.yaml` is out of sync.

`docker compose` starts three services: `api`, `postgres` (dev, port 5432), `postgres-test` (port 5433). The test DB runs migrations automatically via `migrations: { run: true }` in the test TypeORM config.

### Structured Logging

NestJS built-in `Logger` is used throughout. Log level is configurable via `LOG_LEVEL` env var (default `info`). The `GlobalExceptionFilter` logs unhandled exceptions with stack traces at `error` level. Validation errors and domain errors are not logged (they are expected client errors).

### Configuration Management

Pure environment variables — no YAML config files. `ConfigModule.forRoot` with Joi schema validation at startup:

```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
PORT (default 3000)
LOG_LEVEL (default info)
CORS_ORIGINS (comma-separated, default all)
```

The app fails to start if required variables are missing or invalid. `ConfigService` is provided globally.

### Request Tracing

`RequestIdMiddleware` attaches a UUID to every request (`req.id`). The `meta.requestId` field in every response carries this ID back to the client, making request correlation possible across logs.

### Performance Awareness

- All heavy read queries (PR, progress, insights) are bounded by the user's date range — no unbounded full-table scans
- History pagination is cursor-based with a composite index covering the sort — O(log n) per page regardless of depth
- The unique index on `(user_id, exercise_name, date)` serves double duty: integrity + query optimisation for PR/progress (filter by user+exercise, scan dates in order)
- `weight_kg` stored at write time — aggregation queries use the indexed numeric column directly
- `pnpm` with strict lockfile — reproducible, fast CI installs
