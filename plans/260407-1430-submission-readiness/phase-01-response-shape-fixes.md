---
phase: 01
title: Response Shape Fixes
status: completed
priority: P0
effort: 2h
---

# Phase 01 — Response Shape Fixes

Fix all 4 endpoints whose response shapes diverge from `docs/requirements.md`.

## Context Links

- `docs/requirements.md` §3.1–3.5 — canonical response shapes
- `docs/REPORT.md` §⚠️ Response Shape Mismatches — identified gaps
- `src/shared/interceptors/transform-response.interceptor.ts` — adds `meta` key

## Overview

Four response shape changes are needed:

| Endpoint | Current | Required |
|----------|---------|---------|
| `POST /workouts` | `null` | `{ date, userId, entries: [...] }` |
| `GET /workouts/pr` | `{ data: { maxWeight, ... } }` | `{ data: [{ exerciseName, prs: {...}, comparison? }] }` |
| `GET /workouts/progress` | `{ data: { series, groupBy, note } }` | `{ exerciseName, groupBy, unit, data: [...], insufficientData }` |
| `GET /workouts/insights` | `{ data: { mostTrained, ... } }` | `{ period, insights: [{ name, data }] }` |

**Key constraint:** The `TransformResponseInterceptor` spreads `{ ...value, meta }`. For non-`ApiResult` shaped responses (like progress and insights), the interceptor will spread top-level keys directly. This is fine — the interceptor passes through any object.

## Implementation Steps

---

### 1. Fix `POST /workouts` — Return Saved Entries

**Repository interface change** (`src/model/repositories/workout-entry/workout-entry.repository.interface.ts`):

```typescript
// Before
saveEntries(userId: string, date: string, entries: WorkoutEntryInput[]): Promise<void>;

// After
saveEntries(userId: string, date: string, entries: WorkoutEntryInput[]): Promise<SavedWorkoutEntry[]>;
```

**New return types** in `src/model/repositories/workout-entry/workout-entry.repository.types.ts`:
```typescript
export interface SavedSetData {
  id: string;
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
}
export interface SavedWorkoutEntry {
  id: string;
  exerciseName: string;
  sets: SavedSetData[];
  createdAt: string; // ISO 8601 UTC
}
```

**TypeORM repository change** (`typeorm-workout-entry.repository.ts`):
- After `manager.save(WorkoutEntry, entity)`, map the returned entities to `SavedWorkoutEntry[]`
- `createdAt` from `entry.created_at.toISOString()`

**Service change** (`workout-entry.service.ts`):
```typescript
// New return type in dto/log-workout.dto.ts
export interface LogWorkoutEntryDisplay {
  id: string;
  exerciseName: string;
  sets: Array<{ id: string; reps: number; weight: number; unit: string; weightKg: number }>;
  createdAt: string;
}
export interface LogWorkoutResult {
  date: string;
  userId: string;
  entries: LogWorkoutEntryDisplay[];
}

// Service returns LogWorkoutResult (not void)
async logWorkout(userId: string, dto: LogWorkoutDTO): Promise<LogWorkoutResult> {
  const saved = await this.repo.saveEntries(userId, dto.date, entries);
  return { date: dto.date, userId, entries: saved };
}
```

**Controller change** (`workout-entry.controller.ts`):
```typescript
@Post()
@HttpCode(201)
async logWorkout(...): Promise<LogWorkoutResult> {
  return this.service.logWorkout(query.userId, dto);
}
```

**Interceptor note:** The interceptor spreads `{ ...value, meta }`. Since `LogWorkoutResult` has `{ date, userId, entries }`, the final response body will be `{ date, userId, entries, meta }`. ✅ Matches spec (meta is bonus).

---

### 2. Fix `GET /workouts/pr` — Per-Exercise Array + Comparison Deltas

**New DTO shapes** in `src/modules/workout-set/dto/get-pr.dto.ts`:

```typescript
export interface PRValue {
  value: number;      // converted to requested unit
  unit: string;
  reps: number;
  achievedAt: string; // YYYY-MM-DD
}

export interface PRSet {
  maxWeight: PRValue | null;
  maxVolume: PRValue | null;
  bestOneRM: PRValue | null;
}

export interface ComparisonValue {
  current: number;
  previous: number;
  deltaKg: number;
  deltaPct: number;
}

export interface PRComparison {
  period: { from: string; to: string };
  prevPeriod: { from: string; to: string };
  maxWeight?: ComparisonValue;
  maxVolume?: ComparisonValue;
  bestOneRM?: ComparisonValue;
}

export interface PRExerciseResult {
  exerciseName: string;
  prs: PRSet;
  comparison?: PRComparison;
}

export interface GetPRResult {
  data: PRExerciseResult[];
}
```

**Repository interface change** — `findPRSets` must return results grouped by exercise:

```typescript
// New type in workout-set.repository.types.ts
export interface PRSetResult {
  exerciseName: string;
  reps: number;
  weightKg: number;
  date: string;
}
```

The query already joins `workout_entries` — just include `exercise_name` in the SELECT.

**Service logic** (`workout-set.service.ts`):

```typescript
async getPRs(dto: GetPRDTO): Promise<GetPRResult> {
  const sets = await this.repo.findPRSets({...});

  // Group by exercise
  const grouped = Map<string, PRSetResult[]>

  // For each exercise: compute maxWeight, maxVolume, bestOneRM
  // Each PR type: find the set with MAX value and record its date + reps

  // If compareTo=previousPeriod: compute previous period dates, fetch again
  // Build comparison deltas: deltaKg = current - previous, deltaPct = (delta/previous)*100

  return { data: exerciseResults };
}
```

**Key logic — previous period calculation:**
```
period length = (to - from) in days
prevTo = from - 1 day
prevFrom = prevTo - periodLength days
```

If no `from`/`to` provided, `compareTo` uses all-time vs the previous equal window ending before the earliest record. This is complex — simplify: if no date range, omit comparison and return empty `comparison` key.

---

### 3. Fix `GET /workouts/progress` — Flat Response Shape

**New shape** in `src/modules/workout-set/dto/get-progress.dto.ts`:
```typescript
export interface ProgressPoint {
  period: string;
  bestWeight: number;
  volume: number;
}

export interface GetProgressResult {
  exerciseName: string;
  groupBy: GroupBy;
  unit: string;
  data: ProgressPoint[];
  insufficientData: boolean;
}
```

**Service change** (`workout-set.service.ts`):
```typescript
async getProgress(dto: GetProgressDTO): Promise<GetProgressResult> {
  const series = await this.repo.findProgressSeries({...});
  const points = this.aggregateProgress(series, dto.groupBy, dto.unit);
  return {
    exerciseName: dto.exerciseName,
    groupBy: dto.groupBy,
    unit: dto.unit,
    data: points,
    insufficientData: points.length < 2,
  };
}
```

**Interceptor behaviour:** `TransformResponseInterceptor` does `{ ...value, meta }`. Since `GetProgressResult` has top-level keys `exerciseName`, `groupBy`, etc., the final response will be `{ exerciseName, groupBy, unit, data, insufficientData, meta }`. ✅ Matches spec.

---

### 4. Fix `GET /workouts/insights` — Envelope Format + Plugin Output Shapes

**New envelope shape** in `src/modules/exercise-metadata/dto/get-insights.dto.ts`:
```typescript
export interface InsightItem {
  name: string;
  data: unknown;
}

export interface GetInsightsResult {
  period: { from: string; to: string };
  insights: InsightItem[];
}
```

**Plugin interface change** (`insight-plugin.interface.ts`):
```typescript
export interface InsightPlugin {
  readonly name: string;  // was: key
  compute(data: WorkoutData): InsightResult | null; // null = omit from array
}
```

**Service change** (`exercise-metadata.service.ts`):
```typescript
async getInsights(dto: GetInsightsDTO): Promise<GetInsightsResult> {
  const entries = await this.repo.findWorkoutData({...});

  const resolvedFrom = dto.from ?? dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const resolvedTo = dto.to ?? dayjs().format('YYYY-MM-DD');

  if (entries.length === 0) {
    return {
      period: { from: resolvedFrom, to: resolvedTo },
      insights: [],
      message: 'No workout data found for the given period',
    } as any;
  }

  const workoutData = { userId: dto.userId, from: resolvedFrom, to: resolvedTo, entries };
  const insights: InsightItem[] = [];

  for (const plugin of this.plugins) {
    const result = plugin.compute(workoutData);
    if (result !== null) {
      insights.push({ name: plugin.name, data: result });
    }
  }

  return { period: { from: resolvedFrom, to: resolvedTo }, insights };
}
```

**Interceptor behaviour:** The interceptor does `{ ...value, meta }`. Final response: `{ period, insights, meta }`. ✅

**Plugin output shape changes:**

**`most-trained` plugin:**
```typescript
// Output:
{
  byFrequency: [{ exercise: string; sessionCount: number }],
  byVolume:    [{ exercise: string; totalVolumeKg: number }]
}
```

**`training-frequency` plugin:**
```typescript
// Output:
{ sessionsPerWeek: number; totalSessions: number; weeksAnalyzed: number }
```
Add `weeksAnalyzed = Math.round(weeks * 10) / 10`.

**`muscle-balance` plugin:**
```typescript
// Output:
{ distribution: { [group]: number }, warnings: string[] }
```
Add simple warning: if any group < 20% of total volume → "X volume is lower than recommended".

**`neglected-exercise` plugin** (rename from `gaps`):
```typescript
// Output:
{ exercises: [{ name: string; lastSeenDaysAgo: number }] }
```
Change field names: `exerciseName` → `name`, `daysSince` → `lastSeenDaysAgo`.

---

### 5. Update Tests After Shape Changes

- Unit tests for all 4 modified services — update expectations to match new shapes
- Integration tests for all 4 endpoints — update expected response bodies
- Keep the same test scenarios; only update the assertion shapes

---

## Todo List

- [ ] Add `SavedWorkoutEntry` / `SavedSetData` to repository types
- [ ] Update `IWorkoutEntryRepository.saveEntries` return type
- [ ] Update `TypeOrmWorkoutEntryRepository.saveEntries` to return saved entities
- [ ] Add `LogWorkoutResult` / `LogWorkoutEntryDisplay` to log-workout.dto.ts
- [ ] Update `WorkoutEntryService.logWorkout` to return `LogWorkoutResult`
- [ ] Update `WorkoutEntryController.logWorkout` return type
- [ ] Add `PRValue`, `PRSet`, `PRComparison`, `PRExerciseResult` to get-pr.dto.ts
- [ ] Update `PRSetResult` in repository types to include `exerciseName`
- [ ] Update `TypeOrmWorkoutSetRepository.findPRSets` to select `exercise_name`
- [ ] Rewrite `WorkoutSetService.getPRs` to group by exercise + compute deltas
- [ ] Replace `GetProgressResult` in get-progress.dto.ts with flat shape
- [ ] Update `WorkoutSetService.getProgress` to return flat shape
- [ ] Replace `GetInsightsResult` in get-insights.dto.ts with envelope shape
- [ ] Rename `InsightPlugin.key` → `InsightPlugin.name`
- [ ] Update all 4 plugins to use `name` instead of `key`
- [ ] Update `MostTrainedPlugin.compute` output shape (`byFrequency` + `byVolume`)
- [ ] Update `TrainingFrequencyPlugin.compute` to add `weeksAnalyzed`
- [ ] Update `MuscleGroupBalancePlugin.compute` to output `{ distribution, warnings }`
- [ ] Update `GapsPlugin.compute` to output `{ exercises: [{ name, lastSeenDaysAgo }] }`
- [ ] Update `ExerciseMetadataService.getInsights` to use envelope format + empty data message
- [ ] Update all affected unit tests
- [ ] Update all affected integration tests

## Success Criteria

- All 5 endpoints return the exact shapes specified in `docs/requirements.md`
- `pnpm test` all green
- `pnpm test:integration` all green
- No TypeScript compilation errors (`pnpm build`)
