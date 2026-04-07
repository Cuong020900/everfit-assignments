# Phase 05 — Integration Tests

**Priority:** High
**Status:** ✅ complete
**Blocked by:** Phases 02, 03, 04

## Overview

HTTP-level integration tests using NestJS `Test.createTestingModule()` + Supertest against a real test DB (port 5433).

Run with: `pnpm test:integration`

## Test DB Requirements

- `docker compose up` must be running (starts API + postgres + postgres-test)
- Test DB: `workout_test_db` on port `5433`
- Migrations run automatically via `migrationsRun: true` in test config
- Seed test data inline in `beforeEach` / `beforeAll`

## Test Files to Create

### `test/integration/log-workout.spec.ts`

```
POST /workouts?userId=<uuid>

✅ 201 — saves entries and returns 201 with no body
✅ 201 — bulk: saves multiple exercises in one request
✅ 201 — stores weight_kg computed from lb correctly
✅ 400 — missing userId returns validation error
✅ 400 — invalid userId (not UUID) returns INVALID_USER_ID
✅ 400 — empty entries array returns EMPTY_ENTRIES
✅ 400 — entry with empty sets returns EMPTY_SETS
✅ 400 — invalid unit ('stone') returns INVALID_UNIT
✅ 400 — negative weight returns INVALID_WEIGHT
✅ 400 — reps = 0 returns INVALID_REPS
✅ 400 — missing date returns validation error
✅ 400 — invalid date format returns INVALID_DATE
✅ error response shape: { statusCode, error, message }
```

### `test/integration/get-history.spec.ts`

```
GET /workouts?userId=<uuid>

✅ 200 — returns entries for the user
✅ 200 — returns weights in kg by default
✅ 200 — converts weights to lb when unit=lb
✅ 200 — filters by exerciseName (partial match)
✅ 200 — filters by date range (from/to)
✅ 200 — filters by muscleGroup (requires seeded exercise_metadata)
✅ 200 — pagination: returns nextCursor when more pages exist
✅ 200 — pagination: nextCursor null on last page
✅ 200 — pagination: fetching with cursor returns correct next page
✅ 200 — empty result returns { entries: [], nextCursor: null }
✅ 400 — missing userId returns 400
✅ 400 — limit > 100 returns LIMIT_EXCEEDED
```

### `test/integration/get-pr.spec.ts`

```
GET /workouts/pr?userId=<uuid>

✅ 200 — returns maxWeight, maxVolume, best1RM
✅ 200 — each PR includes date
✅ 200 — returns weights in requested unit
✅ 200 — 1RM: Epley formula correct (100kg*5reps = 116.67)
✅ 200 — no data → { maxWeight: null, maxVolume: null, best1RM: null }
✅ 200 — compareTo=previousPeriod returns current+previous objects
✅ 200 — filters by exerciseName
✅ 200 — filters by date range
✅ 400 — missing userId
```

### `test/integration/get-progress.spec.ts`

```
GET /workouts/progress?userId=<uuid>&exerciseName=Bench+Press

✅ 200 — returns series with best weight per day (daily groupBy)
✅ 200 — weekly groupBy: aggregates daily bests into weeks
✅ 200 — monthly groupBy: aggregates daily bests into months
✅ 200 — includes volume trend per period
✅ 200 — returns weight in requested unit
✅ 200 — empty range returns { series: [], note: null }
✅ 200 — single data point returns series with note about insufficient data
✅ 400 — missing exerciseName returns MISSING_EXERCISE_NAME
✅ 400 — missing userId returns 400
```

### `test/integration/get-insights.spec.ts`

```
GET /workouts/insights?userId=<uuid>

✅ 200 — returns all 4 insight types
✅ 200 — mostTrained sorted by session count
✅ 200 — trainingFrequency computed correctly
✅ 200 — muscleGroupBalance uses exercise_metadata mapping
✅ 200 — gaps: identifies exercises not done in 2+ weeks
✅ 200 — empty data: all insights return empty/zero values
✅ 400 — missing userId returns 400
```

## Test Helpers

**File:** `test/integration/helpers/db-cleaner.ts`
```ts
// Truncate tables before each test to ensure isolation
export async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE workout_sets, workout_entries RESTART IDENTITY CASCADE');
}
```

**File:** `test/integration/helpers/app-factory.ts`
```ts
// Bootstrap NestJS app for integration tests
export async function createTestApp(): Promise<{ app: INestApplication; dataSource: DataSource }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  // Apply same global pipes/filters as main.ts
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());
  await app.init();
  const dataSource = moduleRef.get(DataSource);
  return { app, dataSource };
}
```

**File:** `test/integration/helpers/seed.ts`
```ts
// Seed exercise_metadata for muscle group tests
export async function seedExerciseMetadata(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    INSERT INTO exercise_metadata (name, muscle_group, aliases)
    VALUES ('Bench Press', 'chest', '{}'),
           ('Squat', 'legs', '{}'),
           ('Pull-up', 'back', '{}')
    ON CONFLICT (name) DO NOTHING
  `);
}
```

## Setup

Each spec file follows this pattern:
```ts
let app: INestApplication;
let dataSource: DataSource;

beforeAll(async () => {
  ({ app, dataSource } = await createTestApp());
  await seedExerciseMetadata(dataSource);
});

beforeEach(async () => {
  await truncateAll(dataSource);
});

afterAll(async () => {
  await app.close();
});
```

## Success Criteria

- All integration tests pass with `pnpm test:integration`
- No test uses mocked repositories — real DB only
- Error shape `{ statusCode, error, message }` is consistent across all endpoints
- Cursor pagination verified end-to-end
- Epley 1RM verified end-to-end with real stored data
