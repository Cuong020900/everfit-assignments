# Workout Tracking API

A personal workout logging REST API built with NestJS, TypeScript, PostgreSQL, and TypeORM. It lets users log workout sessions, track personal records, analyse progress over time, and surface training insights — all through a clean, well-structured HTTP interface.

---

## Table of Contents

- [Quick Start (Docker)](#quick-start-docker)
- [Local Development](#local-development)
- [API Reference](#api-reference)
  - [POST /workouts — Log a workout](#post-workouts--log-a-workout)
  - [GET /workouts — Workout history](#get-workouts--workout-history)
  - [GET /workouts/pr — Personal records](#get-workoutspr--personal-records)
  - [GET /workouts/progress — Progress over time](#get-workoutsprogress--progress-over-time)
  - [GET /workouts/insights — Training insights](#get-workoutsinsights--training-insights)
- [Database Schema](#database-schema)
- [Technical Decisions & Trade-offs](#technical-decisions--trade-offs)
- [Running Tests](#running-tests)
- [Performance & Stress Testing](#performance--stress-testing)

---

## Quick Start (Docker)

The fastest way to run the project. Starts the API on port 3000 and a PostgreSQL instance — no local Node or database setup needed.

```bash
docker compose up --build
```

Optionally seed exercise metadata (muscle group mappings for the insights endpoint):

```bash
pnpm seed:docker
```

The API is available at `http://localhost:3000`.

---

## Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment config
cp .env.example .env

# 3. Start only the database (Docker)
docker compose up db

# 4. Run the dev server with hot reload
pnpm start:dev
```

The server starts on port 3000 by default. All configuration is via environment variables — see `.env.example` for available options.

| Variable       | Default          | Notes                          |
| -------------- | ---------------- | ------------------------------ |
| `DB_HOST`      | `localhost`      |                                |
| `DB_PORT`      | `5432`           | Test DB uses `5433`            |
| `DB_NAME`      | `workout_db`     | Test DB uses `workout_test_db` |
| `DB_USER`      | `workout`        |                                |
| `DB_PASSWORD`  | `workout`        |                                |
| `PORT`         | `3000`           |                                |
| `LOG_LEVEL`    | `info`           |                                |
| `CORS_ORIGINS` | *(all)*          | Comma-separated list           |

---

## API Reference

Every response includes a `meta.requestId` field for tracing. Errors follow a consistent shape:

```json
{ "statusCode": 400, "error": "Bad Request", "message": "EMPTY_ENTRIES" }
```

---

### POST /workouts — Log a workout

Records a workout session for a user. Each session contains one or more exercise entries, each with one or more sets. Both `kg` and `lb` units are accepted; `weight_kg` is normalised at write time.

**Query params**

| Param    | Required | Description    |
| -------- | -------- | -------------- |
| `userId` | ✅        | UUID of the user |

**Request body**

```json
{
  "date": "2024-01-15",
  "entries": [
    {
      "exerciseName": "Bench Press",
      "sets": [
        { "reps": 10, "weight": 80, "unit": "kg" }
      ]
    }
  ]
}
```

**Response 201**

```json
{
  "date": "2024-01-15",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "entries": [
    {
      "id": "uuid",
      "exerciseName": "Bench Press",
      "sets": [
        {
          "id": "uuid",
          "reps": 10,
          "weight": 80,
          "unit": "kg",
          "weightKg": 80
        }
      ],
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "meta": { "requestId": "req_abc123" }
}
```

**Error codes**

| Code              | Status | Meaning                            |
| ----------------- | ------ | ---------------------------------- |
| `EMPTY_ENTRIES`   | 400    | `entries` array is empty           |
| `INVALID_DATE`    | 400    | Date is not a valid `YYYY-MM-DD`   |
| `INVALID_USER_ID` | 400    | `userId` is not a valid UUID       |

---

### GET /workouts — Workout history

Returns a paginated list of workout entries for a user, ordered by date descending. Supports cursor-based pagination, date range filtering, and exercise name search.

**Query params**

| Param          | Required | Default | Description                              |
| -------------- | -------- | ------- | ---------------------------------------- |
| `userId`       | ✅        | —       | UUID of the user                         |
| `limit`        |          | `20`    | Max entries per page (1–100)             |
| `cursor`       |          | —       | Opaque pagination cursor from previous response |
| `exerciseName` |          | —       | Partial match filter (case-insensitive)  |
| `from`         |          | —       | Start date `YYYY-MM-DD` (inclusive)      |
| `to`           |          | —       | End date `YYYY-MM-DD` (inclusive)        |

**Response 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "date": "2024-01-15",
      "exerciseName": "Bench Press",
      "sets": [
        { "id": "uuid", "reps": 10, "weight": 80, "unit": "kg", "weightKg": 80 }
      ]
    }
  ],
  "pagination": {
    "hasMore": true,
    "nextCursor": "eyJkYXRlIjoiMjAyNC0wMS0xNSIsImlkIjoidXVpZCJ9"
  },
  "meta": { "requestId": "req_abc123" }
}
```

---

### GET /workouts/pr — Personal records

Returns personal records per exercise. Supports optional period filtering and comparison against a previous period of the same length.

**Query params**

| Param          | Required | Default | Description                                        |
| -------------- | -------- | ------- | -------------------------------------------------- |
| `userId`       | ✅        | —       | UUID of the user                                   |
| `exerciseName` |          | —       | Exact match filter                                 |
| `from`         |          | —       | Start date `YYYY-MM-DD`                            |
| `to`           |          | —       | End date `YYYY-MM-DD`                              |
| `unit`         |          | `kg`    | Output unit: `kg` or `lb`                          |
| `compareTo`    |          | —       | Set to `previousPeriod` to include delta comparison |

**Response 200**

```json
{
  "data": [
    {
      "exerciseName": "Bench Press",
      "prs": {
        "maxWeight": {
          "value": 100,
          "unit": "kg",
          "reps": 5,
          "achievedAt": "2024-01-15"
        },
        "maxVolume": {
          "value": 2400,
          "unit": "kg",
          "reps": 10,
          "achievedAt": "2024-01-10"
        },
        "bestOneRM": {
          "value": 116.7,
          "unit": "kg",
          "reps": 5,
          "achievedAt": "2024-01-15"
        }
      },
      "comparison": {
        "period":     { "from": "2024-01-01", "to": "2024-01-31" },
        "prevPeriod": { "from": "2023-12-01", "to": "2023-12-31" },
        "maxWeight":  { "current": 100, "previous": 90, "deltaKg": 10, "deltaPct": 11.1 }
      }
    }
  ],
  "meta": { "requestId": "req_abc123" }
}
```

The `comparison` field is only present when `compareTo=previousPeriod` is passed.

One-rep max (1RM) is estimated using the **Epley formula**: `weight × (1 + reps / 30)`.

---

### GET /workouts/progress — Progress over time

Shows how a single exercise's best weight and total volume have changed over weekly or monthly periods.

**Query params**

| Param          | Required | Default  | Description                          |
| -------------- | -------- | -------- | ------------------------------------ |
| `userId`       | ✅        | —        | UUID of the user                     |
| `exerciseName` | ✅        | —        | Exact exercise name                  |
| `from`         |          | —        | Start date `YYYY-MM-DD`              |
| `to`           |          | —        | End date `YYYY-MM-DD`                |
| `groupBy`      |          | `week`   | Granularity: `week` or `month`       |
| `unit`         |          | `kg`     | Output unit: `kg` or `lb`            |

**Response 200**

```json
{
  "exerciseName": "Bench Press",
  "groupBy": "week",
  "unit": "kg",
  "data": [
    { "period": "2024-W02", "bestWeight": 95, "volume": 2280 },
    { "period": "2024-W03", "bestWeight": 97.5, "volume": 2450 }
  ],
  "insufficientData": false,
  "meta": { "requestId": "req_abc123" }
}
```

`insufficientData: true` is returned when fewer than 2 data points are available for a meaningful trend.

---

### GET /workouts/insights — Training insights

Analyses a user's training over a period and returns a set of structured insight payloads. Each insight is independently computed by a plugin.

**Query params**

| Param    | Required | Description                         |
| -------- | -------- | ----------------------------------- |
| `userId` | ✅        | UUID of the user                    |
| `from`   |          | Start date `YYYY-MM-DD`             |
| `to`     |          | End date `YYYY-MM-DD`               |

**Response 200**

```json
{
  "period": { "from": "2024-01-01", "to": "2024-01-31" },
  "insights": [
    {
      "name": "most-trained",
      "data": {
        "byFrequency": [{ "exercise": "Bench Press", "sessionCount": 8 }],
        "byVolume":    [{ "exercise": "Squat", "totalVolumeKg": 12000 }]
      }
    },
    {
      "name": "training-frequency",
      "data": {
        "sessionsPerWeek": 4.2,
        "totalSessions": 18,
        "weeksAnalyzed": 4.3
      }
    },
    {
      "name": "muscle-group-balance",
      "data": {
        "distribution": { "chest": 35, "legs": 40, "back": 25 },
        "warnings": ["back volume is lower than recommended"]
      }
    },
    {
      "name": "neglected-exercise",
      "data": {
        "exercises": [{ "name": "Deadlift", "lastSeenDaysAgo": 21 }]
      }
    }
  ],
  "meta": { "requestId": "req_abc123" }
}
```

---

## Database Schema

### `workout_entries`

| Column          | Type        | Notes                                    |
| --------------- | ----------- | ---------------------------------------- |
| `id`            | `uuid` PK   | Generated UUID                           |
| `user_id`       | `uuid`      | No FK — referential integrity at app layer |
| `date`          | `DATE`      | Stored and returned as `'YYYY-MM-DD'` string |
| `exercise_name` | `varchar`   |                                          |
| `created_at`    | `timestamp` |                                          |
| `updated_at`    | `timestamp` |                                          |

**Index:** composite `(user_id, date DESC, id DESC)` — supports cursor pagination efficiently.

### `workout_sets`

| Column      | Type          | Notes                                           |
| ----------- | ------------- | ----------------------------------------------- |
| `id`        | `uuid` PK     |                                                 |
| `entry_id`  | `uuid`        | References `workout_entries.id` (app-level FK)  |
| `reps`      | `int`         |                                                 |
| `weight`    | `decimal`     | As entered by the user (kg or lb)               |
| `unit`      | `varchar`     | `'kg'` or `'lb'`                                |
| `weight_kg` | `decimal`     | Normalised to kg at write time                  |
| `created_at`| `timestamp`   |                                                 |
| `updated_at`| `timestamp`   |                                                 |

### `exercise_metadata`

| Column         | Type       | Notes                                  |
| -------------- | ---------- | -------------------------------------- |
| `name`         | `varchar` PK | Canonical exercise name              |
| `muscle_group` | `varchar`  | Used by the muscle-group-balance insight |
| `aliases`      | `varchar[]`| Alternative names for the same exercise |

---

## Technical Decisions & Trade-offs

### Repository pattern

All services depend on `IWorkoutRepository` (injected via token, not the concrete TypeORM class). Unit tests swap the real implementation for an in-memory mock — no database required. Integration tests wire the real TypeORM repository against a dedicated test DB.

### `weight_kg` stored at write time

Unit conversion (kg / lb → kg) happens once during ingest. All aggregations (`SUM`, `MAX`) run directly on `weight_kg` — no `CASE` expressions or function calls in GROUP BY queries.

### DATE column as string

The `pg` driver returns PostgreSQL `DATE` values as `'YYYY-MM-DD'` strings. Wrapping them in `new Date()` introduces timezone shifts depending on the runtime environment. Storing and reading the value as a string is intentional and avoids that class of bug.

### Cursor-based pagination

History is paginated with a base64url-encoded `{ date, id }` composite cursor, backed by a matching `(user_id, date DESC, id DESC)` composite index. Unlike offset-based pagination, cursors remain stable when new rows are inserted mid-pagination — no skipped or duplicated results.

### Plugin system for insights

Each insight is an `InsightPlugin` class registered as a NestJS multi-provider (`{ provide: INSIGHT_PLUGINS, useClass: ..., multi: true }`). `GetInsightsService` receives `InsightPlugin[]` and calls each plugin independently. Adding a new insight requires one new class and one provider registration — no changes to existing code (Open/Closed Principle).

### No authentication

Out of scope for this assignment. `userId` is passed as a query parameter on every request.

### Trade-offs

| Area                     | Current approach                          | At higher scale                               |
| ------------------------ | ----------------------------------------- | --------------------------------------------- |
| **PR query performance** | Composite index; no cache                 | Add Redis cache for frequent PR lookups       |
| **Exercise name matching** | History: ILIKE (partial); PR/Progress: exact match | Add a normalisation layer or full-text index |
| **Referential integrity** | App-layer only; no FK constraints in DB  | Add FK constraints if DB is shared across services |
| **Authentication**       | `userId` query param; no auth             | JWT middleware; extract userId from token     |

---

## Running Tests

### Unit tests (no database required)

```bash
pnpm test
pnpm test:watch    # watch mode
pnpm test:cov      # with coverage report
```

### Integration tests (requires test database)

```bash
# Start the test database on port 5433
docker compose up db-test

# Run integration tests
pnpm test:integration
```

### Run a single test file

```bash
pnpm test -- --testPathPattern=log-workout
pnpm test:integration -- --testPathPattern=get-pr
```

### Test architecture

| Type            | Location                        | DB needed       |
| --------------- | ------------------------------- | --------------- |
| **Unit**        | `test/unit/**/*.spec.ts`        | No              |
| **Integration** | `test/integration/**/*.spec.ts` | Yes (port 5433) |

Unit tests use a `createMockRepository()` factory that returns a typed in-memory mock of `IWorkoutRepository`. Integration tests boot the full NestJS application in-process via `Test.createTestingModule()` and hit it with Supertest over HTTP.

---

## Performance & Stress Testing

Two scripts are provided:

- `scripts/benchmark-multi-user.sh` for large-dataset DB + API benchmark reports
- `scripts/stress-api-concurrency.sh` for API concurrency stress reports (prefers `k6`, falls back to `curl`)

### 1) Large dataset benchmark (multi-user)

This script resets the test DB schema, runs migrations, inserts synthetic data for multiple users, then benchmarks SQL and API read paths.

```bash
# Example: 5 users x 50k entries each
USERS_COUNT=5 ENTRIES_PER_USER=50000 ./scripts/benchmark-multi-user.sh
```

Output report:

- `docs/benchmark-report-<timestamp>.md`

### 2) API concurrency stress test (k6-first)

This script captures machine/docker resource info, runs concurrent API calls across key endpoints, and writes latency/error metrics.

```bash
# Install k6 (macOS)
brew install k6

# Run stress test with multiple concurrency levels
REQUESTS_PER_LEVEL=200 CONCURRENCY_LEVELS=10,20,50,100 ./scripts/stress-api-concurrency.sh
```

Output report:

- `docs/stress-report-<timestamp>.md`

### Useful environment variables

```bash
# Shared
API_BASE_URL=http://localhost:3000
REPORT_DIR=docs

# benchmark-multi-user.sh
DB_HOST=localhost
DB_PORT=5433
DB_NAME=workout_test_db
DB_USER=workout
DB_PASSWORD=workout
USERS_COUNT=5
ENTRIES_PER_USER=50000
SAMPLE_ROUNDS=20
API_CONCURRENCY=20

# stress-api-concurrency.sh
USER_ID=<existing-user-uuid>
REQUESTS_PER_LEVEL=200
CONCURRENCY_LEVELS=10,20,50,100
K6_TIMEOUT=30s
```
