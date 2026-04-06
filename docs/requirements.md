# Everfit Backend — Functional Requirements

> Generated: 2026-04-06
> Sources: `interview_assetment.md` (primary) + `spec.md` + clarification session (5/5 questions answered)

---

## 1. Overview

A NestJS REST API that allows coaches to track client workout metrics — logging exercises, viewing personal records, and visualising progress over time.

**No authentication required.** `userId` is passed as a parameter on every request.

---

## 2. Shared Conventions

### 2.1 User Identification

Every endpoint receives `userId` (UUID) as a **query parameter** or **route parameter** (specified per endpoint). No auth headers are required.

### 2.2 Timestamp & Date Format

- **Input timestamps:** ISO 8601 with any UTC offset (e.g. `2024-01-15T08:00:00+07:00` or `2024-01-15T01:00:00Z`) — normalized to UTC server-side.
- **Input dates:** `YYYY-MM-DD` string — stored as a UTC `DATE` (no time component).
- **Output timestamps:** UTC ISO 8601 string (e.g. `2024-01-15T01:00:00.000Z`).

### 2.3 Weight Units

| Unit | Accepted value |
|------|---------------|
| Kilograms | `"kg"` |
| Pounds | `"lb"` |

All weights are normalized to `kg` server-side (`weight_kg`) for storage and calculations. Original `weight` + `unit` are also stored. Clients may request responses in a specific unit via a `unit` query parameter; the server converts before responding.

Adding a new unit (e.g. `stone`) requires only a single entry in the unit conversion map — no business logic changes.

### 2.4 Error Response Shape

All error responses must follow this exact structure:

```json
{
  "statusCode": 400,
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

### 2.5 Pagination (History endpoint)

| Parameter | Type | Default | Max | Notes |
|-----------|------|---------|-----|-------|
| `limit` | integer | 20 | 100 | Return `400` if `limit > 100` |
| `cursor` | string | — | — | Opaque cursor (encodes `created_at` + `id`) |

---

## 3. Endpoints

---

### 3.1 Log Workout (Bulk)

**`POST /workouts`**

Log one or more workout exercises in a single request. Each item in the `entries` array is one exercise with one or more sets.

#### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | UUID string | Yes | Identifies the coach/user |

#### Request Body

```json
{
  "date": "2024-01-15",
  "entries": [
    {
      "exerciseName": "Bench Press",
      "sets": [
        { "reps": 10, "weight": 100, "unit": "kg" },
        { "reps": 8,  "weight": 105, "unit": "kg" }
      ]
    },
    {
      "exerciseName": "Squat",
      "sets": [
        { "reps": 5, "weight": 140, "unit": "kg" }
      ]
    }
  ]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `date` | `YYYY-MM-DD` string | Yes | Valid calendar date; stored as UTC date |
| `entries` | array | Yes | Minimum 1 element |
| `entries[].exerciseName` | string | Yes | Non-empty |
| `entries[].sets` | array | Yes | Minimum 1 element |
| `entries[].sets[].reps` | integer | Yes | Must be `> 0` |
| `entries[].sets[].weight` | number | Yes | Must be `> 0` |
| `entries[].sets[].unit` | `"kg"` \| `"lb"` | Yes | Must be a supported unit |

#### Success Response — `201 Created`

```json
{
  "date": "2024-01-15",
  "userId": "uuid",
  "entries": [
    {
      "id": "uuid-of-workout-entry",
      "exerciseName": "Bench Press",
      "sets": [
        { "id": "uuid", "reps": 10, "weight": 100, "unit": "kg", "weightKg": 100 },
        { "id": "uuid", "reps": 8,  "weight": 105, "unit": "kg", "weightKg": 105 }
      ],
      "createdAt": "2024-01-15T01:00:00.000Z"
    },
    {
      "id": "uuid-of-workout-entry-2",
      "exerciseName": "Squat",
      "sets": [
        { "id": "uuid", "reps": 5, "weight": 140, "unit": "kg", "weightKg": 140 }
      ],
      "createdAt": "2024-01-15T01:00:00.000Z"
    }
  ]
}
```

#### Error Cases

| Condition | Status | Error Code |
|-----------|--------|------------|
| `entries` array is empty or missing | 400 | `EMPTY_ENTRIES` |
| Any `sets` array is empty | 400 | `EMPTY_SETS` |
| Any `reps` ≤ 0 | 400 | `INVALID_REPS` |
| Any `weight` ≤ 0 | 400 | `INVALID_WEIGHT` |
| Unsupported `unit` value | 400 | `INVALID_UNIT` |
| `date` is null, missing, or invalid format | 400 | `INVALID_DATE` |
| Any `exerciseName` is empty | 400 | `INVALID_EXERCISE_NAME` |
| `userId` is missing or not a valid UUID | 400 | `INVALID_USER_ID` |

---

### 3.2 Get Workout History

**`GET /workouts`**

Returns a paginated, reverse-chronological list of the user's workout entries.

#### Query Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `userId` | UUID | Yes | — | User to query |
| `limit` | integer | No | 20 | Items per page; max 100 |
| `cursor` | string | No | — | Pagination cursor from previous response |
| `exerciseName` | string | No | — | Partial match filter on exercise name (case-insensitive) |
| `from` | `YYYY-MM-DD` | No | — | Inclusive start date filter |
| `to` | `YYYY-MM-DD` | No | — | Inclusive end date filter |
| `muscleGroup` | string | No | — | Filter by muscle group (requires exercise_metadata) |
| `unit` | `"kg"` \| `"lb"` | No | `"kg"` | Unit for weight values in the response |

#### Success Response — `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "date": "2024-01-15",
      "exerciseName": "Bench Press",
      "muscleGroup": "push",
      "sets": [
        { "id": "uuid", "reps": 10, "weight": 220.46, "unit": "lb", "weightKg": 100 }
      ],
      "createdAt": "2024-01-15T01:00:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "opaque-cursor-string-or-null",
    "hasMore": true,
    "limit": 20
  }
}
```

- Weights in `sets` are converted to the requested `unit` before responding.
- `muscleGroup` is populated from `exercise_metadata` if available; `null` if not found.
- Empty results return `200` with `data: []` and `hasMore: false`.

#### Error Cases

| Condition | Status | Error Code |
|-----------|--------|------------|
| `limit > 100` | 400 | `LIMIT_EXCEEDED` |
| `limit < 1` | 400 | `INVALID_LIMIT` |
| `from` or `to` invalid date format | 400 | `INVALID_DATE` |
| `unit` is an unrecognized value | 400 | `INVALID_UNIT` |
| `userId` missing or invalid UUID | 400 | `INVALID_USER_ID` |

---

### 3.3 Get Personal Records (PRs)

**`GET /workouts/pr`**

Returns three PR types per exercise for the given user. Supports optional time-range comparison.

#### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | UUID | Yes | User to query |
| `exerciseName` | string | No | Filter to a single exercise |
| `from` | `YYYY-MM-DD` | No | Start of comparison window |
| `to` | `YYYY-MM-DD` | No | End of comparison window |
| `compareTo` | `"previousPeriod"` | No | When provided, also returns PRs for the equivalent prior period |
| `unit` | `"kg"` \| `"lb"` | No | Default `"kg"` |

#### PR Definitions

| PR Type | Formula | Description |
|---------|---------|-------------|
| `maxWeight` | `MAX(weight_kg)` | Heaviest single set |
| `maxVolume` | `MAX(weight_kg × reps)` | Highest volume single set |
| `bestOneRM` | `MAX(weight_kg × (1 + reps / 30))` | Best estimated 1-rep max (Epley formula) |

#### Success Response — `200 OK`

```json
{
  "data": [
    {
      "exerciseName": "Bench Press",
      "prs": {
        "maxWeight":  { "value": 120, "unit": "kg", "reps": 5,  "achievedAt": "2024-01-10" },
        "maxVolume":  { "value": 900, "unit": "kg", "reps": 10, "achievedAt": "2024-01-08" },
        "bestOneRM":  { "value": 134.0, "unit": "kg", "reps": 5, "achievedAt": "2024-01-10" }
      },
      "comparison": {
        "period":     { "from": "2024-01-01", "to": "2024-01-31" },
        "prevPeriod": { "from": "2023-12-01", "to": "2023-12-31" },
        "maxWeight":  { "current": 120, "previous": 115, "deltaKg": 5, "deltaPct": 4.35 }
      }
    }
  ]
}
```

- `comparison` key is only present when `compareTo=previousPeriod` is supplied.
- If `exerciseName` is provided and no data exists, returns `200` with `data: []`.
- All weight values are expressed in the requested `unit`.

#### Error Cases

| Condition | Status | Error Code |
|-----------|--------|------------|
| `from` after `to` | 400 | `INVALID_DATE_RANGE` |
| `unit` unrecognized | 400 | `INVALID_UNIT` |
| `userId` missing or invalid UUID | 400 | `INVALID_USER_ID` |

---

### 3.4 Get Progress Chart Data

**`GET /workouts/progress`**

Returns time-series data for a specific exercise. Intended for rendering progress charts.

#### Query Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `userId` | UUID | Yes | — | User to query |
| `exerciseName` | string | Yes | — | Exercise to chart |
| `from` | `YYYY-MM-DD` | No | 30 days ago | Start date (inclusive) |
| `to` | `YYYY-MM-DD` | No | today | End date (inclusive) |
| `groupBy` | `"daily"` \| `"weekly"` \| `"monthly"` | No | `"daily"` | Time grouping granularity |
| `unit` | `"kg"` \| `"lb"` | No | `"kg"` | Unit for weight values in the response |

Preset ranges can be expressed as `from`/`to` pairs by the client (1M = last 30 days, 3M = last 90 days, etc.).

#### Aggregation Rules

| `groupBy` | Weight value | Volume value |
|-----------|-------------|-------------|
| `daily` | Best set weight for that day (`MAX(weight_kg)`) | Total volume for that day (`SUM(weight_kg × reps)`) |
| `weekly` | Average of daily best weights for that week | Total volume for that week |
| `monthly` | Average of daily best weights for that month | Total volume for that month |

#### Success Response — `200 OK`

```json
{
  "exerciseName": "Bench Press",
  "groupBy": "weekly",
  "unit": "kg",
  "data": [
    { "period": "2024-W02", "bestWeight": 110,   "volume": 3200 },
    { "period": "2024-W03", "bestWeight": 112.5,  "volume": 3450 },
    { "period": "2024-W04", "bestWeight": 115,    "volume": 3600 }
  ],
  "insufficientData": false
}
```

- `period` format: `"YYYY-MM-DD"` for daily, `"YYYY-WNN"` for weekly, `"YYYY-MM"` for monthly.
- Both `bestWeight` and `volume` are always returned (weight trend + volume trend).
- If fewer than 2 data points in range: `200` with `insufficientData: true`.
- If no data at all: `200` with `data: []` and `insufficientData: true`.

#### Error Cases

| Condition | Status | Error Code |
|-----------|--------|------------|
| `exerciseName` missing | 400 | `MISSING_EXERCISE_NAME` |
| `groupBy` is an invalid value | 400 | `INVALID_GROUP_BY` |
| `from` or `to` invalid date format | 400 | `INVALID_DATE` |
| `from` is after `to` | 400 | `INVALID_DATE_RANGE` |
| `unit` unrecognized | 400 | `INVALID_UNIT` |
| `userId` missing or invalid UUID | 400 | `INVALID_USER_ID` |

---

### 3.5 Get Workout Summary & Insights

**`GET /workouts/insights`**

Returns analytics insights about the user's training patterns. Plugin-based architecture — each insight type is independently computed and can be extended without modifying existing code.

#### Query Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `userId` | UUID | Yes | — | User to query |
| `from` | `YYYY-MM-DD` | No | 30 days ago | Start of analysis window |
| `to` | `YYYY-MM-DD` | No | today | End of analysis window |

#### Built-in Insight Plugins

| Plugin | Description |
|--------|-------------|
| `most-trained` | Most trained exercises by both **frequency** (session count) and **volume** (total `weight_kg × reps`) |
| `training-frequency` | Average sessions per week within the analysis window |
| `muscle-balance` | Volume distribution across muscle groups (requires exercise_metadata); flags imbalances |
| `neglected-exercise` | Exercises not performed in the last **2+ weeks** that were previously performed regularly within the window |

#### Success Response — `200 OK`

```json
{
  "period": { "from": "2023-12-07", "to": "2024-01-06" },
  "insights": [
    {
      "name": "most-trained",
      "data": {
        "byFrequency": [
          { "exercise": "Bench Press", "sessionCount": 12 },
          { "exercise": "Squat",       "sessionCount": 10 }
        ],
        "byVolume": [
          { "exercise": "Squat",       "totalVolumeKg": 42000 },
          { "exercise": "Bench Press", "totalVolumeKg": 38500 }
        ]
      }
    },
    {
      "name": "training-frequency",
      "data": {
        "sessionsPerWeek": 4.2,
        "totalSessions": 17,
        "weeksAnalyzed": 4
      }
    },
    {
      "name": "muscle-balance",
      "data": {
        "distribution": { "push": 45, "pull": 30, "legs": 25 },
        "warnings": ["Pull volume is lower than recommended 1:1 ratio with Push"]
      }
    },
    {
      "name": "neglected-exercise",
      "data": {
        "exercises": [
          { "name": "Deadlift",           "lastSeenDaysAgo": 18 },
          { "name": "Romanian Deadlift",  "lastSeenDaysAgo": 21 }
        ]
      }
    }
  ]
}
```

- If no data in the window: `200` with `insights: []` and `"message": "No workout data found for the given period"`.
- A plugin that cannot produce a result due to insufficient data omits itself from the array.
- `neglected-exercise` threshold: absent for **≥ 14 days** and present before that within the analysis window.

#### Extensibility Contract

New insight types are added by implementing `InsightPlugin` and registering in the module. No existing code is modified (Open/Closed Principle).

```typescript
interface InsightPlugin {
  name: string;
  compute(data: WorkoutData): InsightResult;
}
```

#### Error Cases

| Condition | Status | Error Code |
|-----------|--------|------------|
| `from` or `to` invalid date format | 400 | `INVALID_DATE` |
| `from` is after `to` | 400 | `INVALID_DATE_RANGE` |
| `userId` missing or invalid UUID | 400 | `INVALID_USER_ID` |

---

## 4. Data Model

### 4.1 workout_entries

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | Auto-generated |
| `user_id` | UUID | NOT NULL | Passed as request param |
| `date` | DATE | NOT NULL | UTC date; no time component |
| `exercise_name` | VARCHAR | NOT NULL | Verbatim as submitted |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | UTC |

### 4.2 workout_sets

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | Auto-generated |
| `entry_id` | UUID | FK → workout_entries | Cascade delete |
| `reps` | INTEGER | NOT NULL, > 0 | |
| `weight` | NUMERIC | NOT NULL, > 0 | Original submitted value |
| `unit` | VARCHAR | NOT NULL | `'kg'` or `'lb'` |
| `weight_kg` | NUMERIC | NOT NULL | Normalized; used for all aggregation queries |

### 4.3 exercise_metadata

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `name` | VARCHAR | PK | Canonical exercise name |
| `muscle_group` | VARCHAR | NOT NULL | e.g. `'push'`, `'pull'`, `'legs'` |
| `aliases` | TEXT[] | | Alternative names for partial matching |

### 4.4 Indexes

```sql
-- History queries + date filtering
CREATE INDEX idx_entries_user_date      ON workout_entries(user_id, date DESC);
-- History + PR queries by exercise
CREATE INDEX idx_entries_user_exercise  ON workout_entries(user_id, exercise_name, date DESC);
-- Set joins
CREATE INDEX idx_sets_entry             ON workout_sets(entry_id);
-- PR queries
CREATE INDEX idx_sets_weight_kg         ON workout_sets(weight_kg DESC);
```

---

## 5. Business Logic Rules

### 5.1 Weight Normalization

```
weight_kg = weight × UNIT_TO_KG[unit]

UNIT_TO_KG = { kg: 1, lb: 0.453592 }
```

Adding a new unit requires only a new entry in this map.

### 5.2 Epley 1RM Formula

```
estimated_1RM = weight_kg × (1 + reps / 30)
```

Used for `bestOneRM` PR type and the `estimatedOneRM` progress metric.

### 5.3 Personal Record Definitions

| Type | Query |
|------|-------|
| `maxWeight` | `MAX(ws.weight_kg)` |
| `maxVolume` | `MAX(ws.weight_kg * ws.reps)` |
| `bestOneRM` | `MAX(ws.weight_kg * (1 + ws.reps / 30.0))` |

All computed via SQL aggregation, not application-layer processing.

### 5.4 Progress Aggregation

- **Daily:** Best weight = `MAX(weight_kg)` per day. Volume = `SUM(weight_kg × reps)` per day.
- **Weekly:** Best weight = `AVG` of daily best weights for that ISO week. Volume = sum of all sets that week.
- **Monthly:** Best weight = `AVG` of daily best weights for that calendar month. Volume = sum of all sets that month.

### 5.5 Concurrent Writes

Duplicate `(user_id, date, exercise_name)` entries are permitted. `created_at` is used to disambiguate at query time where needed.

### 5.6 Timezone Strategy

- Accept ISO 8601 with any UTC offset; normalize to UTC server-side.
- `date` field stored as `DATE` (no time component) in UTC — document this trade-off in README.
- Return timestamps as UTC; clients are responsible for local conversion.

---

## 6. Non-Functional Requirements

| Attribute | Target |
|-----------|--------|
| Containerization | `docker compose up` starts the full stack with no additional config |
| Database migrations | Run automatically on container start |
| Structured logging | All requests logged in JSON format (Pino or Winston) |
| Performance | Endpoints must perform well with **50,000+ workout entries per user** |
| Aggregations | All aggregation logic in PostgreSQL (window functions, GROUP BY) — not application layer |
| Test coverage | Edge case coverage prioritized over coverage percentage |
| Scale readiness | Composite indexes in place; README documents scale-up strategy (materialized views, Redis, partitioning) |

---

## 7. Edge Cases & Error Handling Summary

| Scenario | Expected Behaviour |
|----------|--------------------|
| `entries` / `sets` array is empty | 400 with specific error code |
| `weight` or `reps` ≤ 0 | 400 `INVALID_WEIGHT` / `INVALID_REPS` |
| Unsupported unit string | 400 `INVALID_UNIT` |
| `limit > 100` on history | 400 `LIMIT_EXCEEDED` |
| Date range with no data | 200 with empty array + descriptive message |
| Exercise with only 1 data point in progress | 200 with `insufficientData: true` |
| PR queried for unknown exercise | 200 with `data: []` |
| Insights with no data in window | 200 with `insights: []` + message |
| ISO 8601 timestamp with non-UTC offset | Accepted; normalized to UTC |
| Concurrent writes for same exercise + date | Permitted; no unique constraint error |
| History filter with unknown muscle group | 200 with `data: []` |

---

## 8. Acceptance Criteria

### UC-1: Log Workout (Bulk)
- [ ] Given valid input with multiple entries, `POST /workouts` returns `201` with all created entries
- [ ] Single-entry payloads also work (backwards-compatible)
- [ ] `weight_kg` is correctly normalized for both `kg` and `lb` inputs
- [ ] All validation rules (reps, weight, unit, date, sets, entries) are enforced with correct error codes
- [ ] Concurrent posts for the same `(userId, date, exerciseName)` do not cause server errors

### UC-2: Get History
- [ ] Returns entries in reverse-chronological order
- [ ] Default page size is 20; `nextCursor` enables fetching next page
- [ ] `limit=100` is accepted; `limit=101` returns 400
- [ ] `exerciseName` partial match filter works case-insensitively
- [ ] `muscleGroup` filter returns only entries matching that group
- [ ] `unit` param converts all weights in the response
- [ ] `from`/`to` date range filters work independently and in combination
- [ ] Empty result returns `200` with `data: []`

### UC-3: Get PRs
- [ ] All 3 PR types (`maxWeight`, `maxVolume`, `bestOneRM`) are returned per exercise
- [ ] `achievedAt` date is accurate for each PR type
- [ ] `compareTo=previousPeriod` returns delta values for the prior equivalent window
- [ ] No data for exercise returns `200` with `data: []`
- [ ] `unit` param converts all weight values in response

### UC-4: Get Progress
- [ ] Both `bestWeight` and `volume` are present in every data point
- [ ] `groupBy=daily`, `weekly`, `monthly` produce correct aggregation per spec rules
- [ ] Weekly best weight = average of daily bests (not raw max)
- [ ] Default range is last 30 days when `from`/`to` omitted
- [ ] `insufficientData: true` when fewer than 2 data points
- [ ] `from` after `to` returns 400

### UC-5: Get Insights
- [ ] `most-trained` returns rankings by both frequency and volume
- [ ] `training-frequency` returns `sessionsPerWeek` calculated correctly
- [ ] `muscle-balance` uses exercise_metadata for muscle group mapping
- [ ] `neglected-exercise` correctly flags exercises absent for ≥ 14 days
- [ ] Adding a new plugin class does not require modifying existing use-case or controller code
- [ ] No workout data in window returns `200` with `insights: []` and a message

---

## 9. Submission Checklist (from assessment)

- [ ] GitHub repository with clean, iterative commit history
- [ ] `README.md`: architecture diagram, setup instructions, API docs, schema design, trade-offs at scale
- [ ] `AI_WORKFLOW.md`: tools used, ≥2 AI mistakes corrected, ≥1 AI suggestion rejected, prompting strategy
- [ ] `docker compose up` works out of the box
- [ ] Video walkthrough (English, 15–20 min) covering all 6 required points
